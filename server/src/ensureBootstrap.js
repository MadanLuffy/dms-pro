import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma.js';

import crypto from 'crypto';

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

  const superadminCount = await prisma.user.count({ where: { role: 'SUPERADMIN' } });
  if (superadminCount > 0) {
    console.log(`[dms-server] Database has ${superadminCount} SUPERADMIN user(s); skipping bootstrap admin.`);
    return;
  }

  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@skandasoft.com').trim().toLowerCase();
  const name = process.env.BOOTSTRAP_ADMIN_NAME || 'Admin';
  const hasEnvCreds = !!process.env.BOOTSTRAP_ADMIN_EMAIL && !!process.env.BOOTSTRAP_ADMIN_PASSWORD;

  let password;
  if (hasEnvCreds) {
    password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  } else {
    password = crypto.randomBytes(6).toString('hex');
    console.log(`[dms-server] No BOOTSTRAP_ADMIN_PASSWORD set. Generated random password: ${password}`);
  }

  await prisma.user.create({
    data: {
      email,
      name,
      role: 'SUPERADMIN',
      deptId: 'IT',
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  console.log(`[dms-server] Created first SUPERADMIN ${email}`);
}
