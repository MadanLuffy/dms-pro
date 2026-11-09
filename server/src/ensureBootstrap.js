import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma.js';

const DEPARTMENTS = [
  { id: 'HR', name: 'Human Resources (HR)' },
  { id: 'ADMIN', name: 'Administration' },
  { id: 'FINANCE', name: 'Finance & Accounts' },
  { id: 'IT', name: 'Information Technology' },
  { id: 'LEGAL', name: 'Legal' },
  { id: 'OPERATIONS', name: 'Operations' },
];

export async function ensureBootstrap() {
  // 1. Ensure essential departments exist
  for (const dept of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { id: dept.id },
      update: { name: dept.name },
      create: dept,
    });
  }

  const defaultPassword = 'Password@123';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 2. Ensure the 4 key roles for HR Demo exist with standard credentials
  const demoUsers = [
    // 1) System Administrator
    {
      email: 'admin@dms.com',
      name: 'System Administrator',
      role: 'SUPERADMIN',
      deptId: 'IT',
    },
    {
      email: 'admin@skandasoft.com',
      name: 'System Administrator',
      role: 'SUPERADMIN',
      deptId: 'IT',
    },

    // 2) Managing Director (MD / Executive)
    {
      email: 'md@dms.com',
      name: 'Dr. Suresh Kumar (MD)',
      role: 'CEO',
      deptId: 'ADMIN',
    },
    {
      email: 'ceo@skandasoft.com',
      name: 'Dr. Suresh Kumar (MD)',
      role: 'CEO',
      deptId: 'ADMIN',
    },

    // 3) Head of Staff / HR Head (Department Head)
    {
      email: 'head.hr@dms.com',
      name: 'Vikram Singh (Head of HR)',
      role: 'DEPT_HEAD',
      deptId: 'HR',
    },
    {
      email: 'hr.head@dms.com',
      name: 'Vikram Singh (Head of HR)',
      role: 'DEPT_HEAD',
      deptId: 'HR',
    },

    // 4) One Staff (HR Staff / Section Assistant)
    {
      email: 'staff.hr@dms.com',
      name: 'Priya Sharma (HR Staff)',
      role: 'STAFF',
      deptId: 'HR',
    },
    {
      email: 'hr.staff@dms.com',
      name: 'Priya Sharma (HR Staff)',
      role: 'STAFF',
      deptId: 'HR',
    },
  ];

  // Optional custom bootstrap admin from environment if provided
  if (process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD) {
    demoUsers.push({
      email: process.env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase(),
      name: process.env.BOOTSTRAP_ADMIN_NAME || 'Admin',
      role: 'SUPERADMIN',
      deptId: 'IT',
      customPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    });
  }

  for (const u of demoUsers) {
    const hash = u.customPassword ? await bcrypt.hash(u.customPassword, 10) : passwordHash;
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        deptId: u.deptId,
        passwordHash: hash,
      },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        deptId: u.deptId,
        passwordHash: hash,
      },
    });
  }

  console.log('[dms-server] HR Demo accounts initialized (MD, Head of Staff, HR Staff, System Admin). Password: Password@123');
}
