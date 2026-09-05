import { prisma } from '../lib/prisma.js';

export async function listDepartments(_req, res, next) {
  try {
    const departments = await prisma.department.findMany({ orderBy: { id: 'asc' } });
    res.json({ departments });
  } catch (err) {
    next(err);
  }
}

export async function listDemoUsers(_req, res, next) {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, deptId: true },
      take: 8,
      orderBy: { name: 'asc' },
    });
    res.json({ users });
  } catch (err) {
    next(err);
  }
}

export async function listUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      where: { role: { not: 'SUPERADMIN' } },
      include: { department: true },
      orderBy: { name: 'asc' },
    });
    res.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        deptId: u.deptId,
        departmentName: u.department?.name,
      })),
    });
  } catch (err) {
    next(err);
  }
}