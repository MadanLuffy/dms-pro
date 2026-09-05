import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken, setAuthCookie, clearAuthCookie } from '../utils/jwt.js';
import { createAuditLog } from '../utils/audit.js';
export { createUser } from './admin.controller.js';

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

export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { department: true },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = signToken({ sub: user.id, email: user.email });
    setAuthCookie(res, token);
    await createAuditLog({
      userId: user.id,
      userName: user.name,
      action: 'LOGIN',
      details: { email: user.email },
      ipAddress: req.ipAddress,
    });
    return res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res) {
  const user = req.user;
  clearAuthCookie(res);
  if (user) {
    await createAuditLog({
      userId: user.id,
      userName: user.name,
      action: 'LOGOUT',
      ipAddress: req.ipAddress,
    });
  }
  return res.json({ ok: true });
}

export async function me(req, res) {
  return res.json({ user: toPublicUser(req.user) });
}