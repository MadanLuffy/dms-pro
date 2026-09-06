import '../src/loadEnv.js';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEV_PASSWORD = 'Password@123';

async function main() {
  const isProd = process.env.NODE_ENV === 'production';
  const allowDemo = process.env.ALLOW_DEMO_SEED === 'true';
  const forceClear = process.env.SEED_FORCE_CLEAR === 'true';

  if (isProd && allowDemo) {
    console.log('[seed] WARNING: ALLOW_DEMO_SEED=true in production. This is for isolated demo environments only.');
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0 && !forceClear) {
      console.log('[seed] Database already has users. Refusing to wipe. Set SEED_FORCE_CLEAR=true only for a disposable demo database.');
      return;
    }
  }

  const depts = [
    { id: 'FINANCE', name: 'Finance' },
    { id: 'HR', name: 'Human Resources' },
    { id: 'IT', name: 'Information Technology' },
    { id: 'LEGAL', name: 'Legal' },
    { id: 'OPERATIONS', name: 'Operations' },
  ];

  if (isProd && !allowDemo) {
    console.log('[seed] Production bootstrap — demo credentials will not be created.');
    for (const dept of depts) {
      await prisma.department.upsert({
        where: { id: dept.id },
        update: { name: dept.name },
        create: dept,
      });
    }
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (!email || !password) {
      console.log('[seed] Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD to create the first SUPERADMIN.');
      return;
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log('[seed] Bootstrap admin already exists:', email);
      return;
    }
    await prisma.user.create({
      data: {
        email,
        name: process.env.BOOTSTRAP_ADMIN_NAME || 'Administrator',
        role: 'SUPERADMIN',
        deptId: 'IT',
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    console.log('[seed] Created bootstrap SUPERADMIN', email);
    return;
  }

  console.log('[seed] Clearing existing data...');
  await prisma.auditLog.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.note.deleteMany();
  await prisma.approvalMatrix.deleteMany();
  await prisma.subjectFileDept.deleteMany();
  await prisma.subjectFile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();

  console.log('[seed] Creating departments...');
  await prisma.department.createMany({ data: depts });

  const hash = await bcrypt.hash(DEV_PASSWORD, 10);

  console.log('[seed] Creating users...');
  const users = [
    { email: 'ravi.kumar@skandasoft.com', name: 'Ravi Kumar', role: 'STAFF', deptId: 'IT' },
    { email: 'priya.sharma@skandasoft.com', name: 'Priya Sharma', role: 'STAFF', deptId: 'FINANCE' },
    { email: 'amit.patel@skandasoft.com', name: 'Amit Patel', role: 'STAFF', deptId: 'HR' },
    { email: 'sunil.verma@skandasoft.com', name: 'Sunil Verma', role: 'DEPT_HEAD', deptId: 'IT' },
    { email: 'neha.gupta@skandasoft.com', name: 'Neha Gupta', role: 'DEPT_HEAD', deptId: 'FINANCE' },
    { email: 'vikram.singh@skandasoft.com', name: 'Vikram Singh', role: 'DEPT_HEAD', deptId: 'HR' },
    { email: 'anita.desai@skandasoft.com', name: 'Anita Desai', role: 'DEPT_HEAD', deptId: 'LEGAL' },
    { email: 'rajesh.mehta@skandasoft.com', name: 'Rajesh Mehta', role: 'DEPT_HEAD', deptId: 'OPERATIONS' },
    { email: 'ceo@skandasoft.com', name: 'CEO', role: 'CEO', deptId: 'IT' },
    { email: 'admin@skandasoft.com', name: 'Admin', role: 'SUPERADMIN', deptId: 'IT' },
  ];

  const created = {};
  for (const u of users) {
    created[u.email] = await prisma.user.create({
      data: { ...u, passwordHash: hash },
    });
  }

  console.log('[seed] Creating sample files...');
  const now = new Date();
  const files = [
    {
      refNo: 'DMS-KPYJ2M',
      subject: 'Quarterly Financial Compliance Report',
      priority: 'HIGH',
      secrecy: 'CONFIDENTIAL',
      status: 'CEO_REVIEW',
      creatorId: created['priya.sharma@skandasoft.com'].id,
      assignedOfficerId: created['ravi.kumar@skandasoft.com'].id,
      targetDepts: ['FINANCE', 'LEGAL'],
    },
    {
      refNo: 'DMS-V9AQR7',
      subject: 'IT Infrastructure Security Policy v2.0',
      priority: 'URGENT',
      secrecy: 'INTERNAL',
      status: 'DEPT_HEAD_REVIEW',
      creatorId: created['ravi.kumar@skandasoft.com'].id,
      assignedOfficerId: created['sunil.verma@skandasoft.com'].id,
      targetDepts: ['IT', 'OPERATIONS'],
    },
  ];

  for (const f of files) {
    const createdFile = await prisma.subjectFile.create({
      data: {
        ...f,
        targetDepts: {
          create: f.targetDepts.map((d) => ({ deptId: d })),
        },
      },
    });

    for (const deptId of f.targetDepts) {
      await prisma.approvalMatrix.create({
        data: {
          fileId: createdFile.id,
          deptId,
          gate: 'DEPT',
          status: f.status === 'CEO_REVIEW' ? 'APPROVED' : deptId === f.targetDepts[0] ? 'PENDING' : 'PENDING',
          reviewedBy: f.status === 'CEO_REVIEW' ? created[`${f.targetDepts[0] === 'FINANCE' ? 'neha.gupta' : 'sunil.verma'}@skandasoft.com`].id : null,
          comments: f.status === 'CEO_REVIEW' ? 'Approved - verified against SOP-2024' : null,
          timestamp: f.status === 'CEO_REVIEW' ? new Date(now.getTime() - 86400000) : null,
        },
      });
    }
    await prisma.approvalMatrix.create({
      data: {
        fileId: createdFile.id,
        deptId: f.targetDepts[0],
        gate: 'CEO',
        status: f.status === 'CEO_REVIEW' ? 'PENDING' : 'PENDING',
      },
    });

    await prisma.note.createMany({
      data: [
        {
          fileId: createdFile.id,
          authorId: createdFile.creatorId,
          version: 1,
          order: 1,
          content: 'Please review and provide approval on the attached report.',
          sentTo: f.targetDepts.join(', '),
        },
      ],
    });
  }

  await prisma.auditLog.createMany({
    data: [
      {
        userId: created['admin@skandasoft.com'].id,
        userName: 'Admin',
        action: 'SYSTEM_BOOTSTRAP',
        details: 'Seed data initialized',
        ipAddress: '127.0.0.1',
      },
    ],
  });

  console.log('[seed] Done. Demo password for all users: Password@123');
  console.log('[seed] Users:');
  for (const u of users) {
    console.log(`  ${u.role.padEnd(10)} ${u.email.padEnd(40)} ${u.department ? '' : ''}${u.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());