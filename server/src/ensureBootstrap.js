import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma.js';

const DEPARTMENTS = [
  { id: 'FINANCE', name: 'Finance' },
  { id: 'HR', name: 'Human Resources' },
  { id: 'IT', name: 'Information Technology' },
  { id: 'LEGAL', name: 'Legal' },
  { id: 'OPERATIONS', name: 'Operations' },
];

export async function ensureBootstrap() {
  for (const dept of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { id: dept.id },
      update: { name: dept.name },
      create: dept,
    });
  }

  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log(`[dms-server] Database has ${userCount} user(s); skipping bootstrap admin.`);
    return;
  }

  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@skandasoft.com').trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'Password@123';
  const name = process.env.BOOTSTRAP_ADMIN_NAME || 'Admin';
  const usedDefaults = !process.env.BOOTSTRAP_ADMIN_EMAIL || !process.env.BOOTSTRAP_ADMIN_PASSWORD;

  await prisma.user.create({
    data: {
      email,
      name,
      role: 'SUPERADMIN',
      deptId: 'IT',
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  if (usedDefaults) {
    console.log(`[dms-server] Created first SUPERADMIN ${email} with the default demo password. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD on the host to use your own login.`);
  } else {
    console.log(`[dms-server] Created first SUPERADMIN ${email}`);
  }
}
