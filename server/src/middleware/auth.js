import { prisma } from '../lib/prisma.js';
import { verifyToken } from '../utils/jwt.js';

async function loadUser(userId) {
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    include: { department: true },
  });
}

export async function requireAuth(req, res, next) {
  const token = req.cookies?.dms_token;
  const payload = token ? verifyToken(token) : null;
  const user = await loadUser(payload?.sub);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = user;
  req.ipAddress = req.ip?.replace('::ffff:', '') || 'unknown';
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient privileges' });
    }
    next();
  };
}