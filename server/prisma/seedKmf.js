import '../src/loadEnv.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const kmfDepts = [
  { id: 'ADMIN', name: 'Administration & HR (ಆಡಳಿತ ಮತ್ತು ಮಾನವ ಸಂಪನ್ಮೂಲ)' },
  { id: 'ACCOUNTS', name: 'Accounts & Finance (ಲೆಕ್ಕಪತ್ರ ಮತ್ತು ಹಣಕಾಸು)' },
  { id: 'PURCHASE', name: 'Purchase & Stores (ಖರೀದಿ ಮತ್ತು ದಾಸ್ತಾನು)' },
  { id: 'PRODUCTION', name: 'Dairy Processing & Production (ಡೈರಿ ಉತ್ಪಾದನೆ)' },
  { id: 'QC', name: 'Quality Control & Lab (ಗುಣಮಟ್ಟ ನಿಯಂತ್ರಣ)' },
  { id: 'MARKETING', name: 'Marketing & Sales (ಮಾರುಕಟ್ಟೆ ಮತ್ತು ಮಾರಾಟ)' },
  { id: 'TRANSPORT', name: 'Transport & Logistics (ಸಾರಿಗೆ ಮತ್ತು ವಾಹನ ವಿಭಾಗ)' },
  { id: 'VETERINARY', name: 'Animal Husbandry & P&I (ಪಶು ಸಂಗೋಪನೆ ಮತ್ತು ವಿಸ್ತರಣೆ)' },
  { id: 'IT', name: 'Information Technology (ಮಾಹಿತಿ ತಂತ್ರಜ್ಞಾನ)' },
  // Keep standard references
  { id: 'FINANCE', name: 'Finance (ಹಣಕಾಸು)' },
  { id: 'HR', name: 'Human Resources (ಮಾನವ ಸಂಪನ್ಮೂಲ)' },
  { id: 'LEGAL', name: 'Legal (ಕಾನೂನು)' },
  { id: 'OPERATIONS', name: 'Operations (ಕಾರ್ಯಾಚರಣೆ)' },
];

async function main() {
  console.log('[KMF Seed] Upserting official KMF Kolar departments...');
  for (const dept of kmfDepts) {
    await prisma.department.upsert({
      where: { id: dept.id },
      update: { name: dept.name },
      create: dept,
    });
    console.log(`  ✓ ${dept.id} — ${dept.name}`);
  }
  console.log('[KMF Seed] Finished departments.');

  const bcrypt = (await import('bcryptjs')).default;
  const passwordHash = await bcrypt.hash('Password@123', 10);

  const kmfUsers = [
    {
      email: 'md@kmf-kolar.coop',
      name: 'Dr. Suresh Kumar (MD)',
      role: 'CEO',
      deptId: 'ADMIN',
    },
    {
      email: 'manager.accounts@kmf-kolar.coop',
      name: 'Ramesh Babu (Manager Accounts)',
      role: 'DEPT_HEAD',
      deptId: 'ACCOUNTS',
    },
    {
      email: 'manager.purchase@kmf-kolar.coop',
      name: 'Manjunath G (Manager Purchase)',
      role: 'DEPT_HEAD',
      deptId: 'PURCHASE',
    },
    {
      email: 'clerk.purchase@kmf-kolar.coop',
      name: 'Anand Murthy (Purchase Assistant)',
      role: 'STAFF',
      deptId: 'PURCHASE',
    },
    {
      email: 'clerk.accounts@kmf-kolar.coop',
      name: 'Shwetha R (Accounts Assistant)',
      role: 'STAFF',
      deptId: 'ACCOUNTS',
    },
    {
      email: 'admin@kmf-kolar.coop',
      name: 'KMF System Admin',
      role: 'SUPERADMIN',
      deptId: 'IT',
    },
  ];

  console.log('[KMF Seed] Upserting official KMF demo users...');
  for (const u of kmfUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, deptId: u.deptId, passwordHash },
      create: { ...u, passwordHash },
    });
    console.log(`  ✓ ${u.email} — ${u.name} (${u.role})`);
  }
  console.log('[KMF Seed] Finished successfully.');
}

main()
  .catch((e) => {
    console.error('[KMF Seed] Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
