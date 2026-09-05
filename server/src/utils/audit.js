import { prisma } from '../lib/prisma.js';

export async function createAuditLog({ userId, userName, action, details = '', ipAddress }) {
  try {
    return await prisma.auditLog.create({
      data: {
        userId,
        userName,
        action,
        details: typeof details === 'string' ? details : JSON.stringify(details),
        ipAddress,
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
    return null;
  }
}