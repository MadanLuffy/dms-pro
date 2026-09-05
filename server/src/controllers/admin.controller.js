import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { createAuditLog } from '../utils/audit.js';
import { ROLES } from '../constants.js';

const SALT_ROUNDS = 10;
const DEPT_ID = /^[A-Z][A-Z0-9_]{1,19}$/;
const MIN_PASSWORD = 8;

function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    deptId: user.deptId,
    departmentName: user.department?.name || '',
    createdAt: user.createdAt,
  };
}

function slugDeptId(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);
}

export async function createDepartment(req, res, next) {
  try {
    const name = String(req.body?.name || '').trim();
    const id = slugDeptId(req.body?.id || name);
    if (!name) return res.status(400).json({ error: 'Department name is required' });
    if (!DEPT_ID.test(id)) {
      return res.status(400).json({
        error: 'Department ID must be 2–20 characters: start with a letter, then A–Z, 0–9, or _ (e.g. PROCUREMENT)',
      });
    }

    const existing = await prisma.department.findUnique({ where: { id } });
    if (existing) return res.status(409).json({ error: `Department ${id} already exists` });

    const department = await prisma.department.create({ data: { id, name } });
    await createAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      action: 'DEPT_CREATED',
      details: { deptId: department.id, name: department.name },
      ipAddress: req.ipAddress,
    });
    return res.status(201).json({ department });
  } catch (err) {
    next(err);
  }
}

export async function createUser(req, res, next) {
  try {
    const { email, name, password, role, deptId } = req.body || {};
    if (!email || !name || !password || !role || !deptId) {
      return res.status(400).json({ error: 'email, name, password, role, and deptId are required' });
    }
    if (String(password).length < MIN_PASSWORD) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters` });
    }
    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ error: `Invalid role. Allowed: ${Object.values(ROLES).join(', ')}` });
    }

    const dept = await prisma.department.findUnique({ where: { id: deptId } });
    if (!dept) return res.status(400).json({ error: 'Invalid department' });

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: String(name).trim(),
        passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
        role,
        deptId,
      },
      include: { department: true },
    });
    await createAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      action: 'USER_CREATED',
      details: { target: user.email, role, deptId },
      ipAddress: req.ipAddress,
    });
    return res.status(201).json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req, res, next) {
  try {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const { name, role, deptId, password } = req.body || {};
    const data = {};
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return res.status(400).json({ error: 'Name cannot be empty' });
      data.name = trimmed;
    }
    if (role !== undefined) {
      if (!Object.values(ROLES).includes(role)) {
        return res.status(400).json({ error: `Invalid role. Allowed: ${Object.values(ROLES).join(', ')}` });
      }
      data.role = role;
    }
    if (deptId !== undefined) {
      const dept = await prisma.department.findUnique({ where: { id: deptId } });
      if (!dept) return res.status(400).json({ error: 'Invalid department' });
      data.deptId = deptId;
    }
    if (password) {
      if (String(password).length < MIN_PASSWORD) {
        return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters` });
      }
      data.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    }
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nothing to update' });
    if (data.role && data.role !== 'SUPERADMIN' && existing.role === 'SUPERADMIN') {
      const remaining = await prisma.user.count({
        where: { role: 'SUPERADMIN', NOT: { id: existing.id } },
      });
      if (remaining === 0) {
        return res.status(400).json({ error: 'Cannot remove the last SUPERADMIN' });
      }
    }

    const user = await prisma.user.update({
      where: { id: existing.id },
      data,
      include: { department: true },
    });
    await createAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      action: 'USER_UPDATED',
      details: { target: user.email, role: user.role, deptId: user.deptId },
      ipAddress: req.ipAddress,
    });
    return res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function listAdminDirectory(req, res, next) {
  try {
    const [departments, users] = await Promise.all([
      prisma.department.findMany({
        orderBy: { id: 'asc' },
        include: { _count: { select: { users: true } } },
      }),
      prisma.user.findMany({
        include: { department: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    res.json({
      departments: departments.map((d) => ({ id: d.id, name: d.name, userCount: d._count.users })),
      users: users.map(toPublicUser),
    });
  } catch (err) {
    next(err);
  }
}
