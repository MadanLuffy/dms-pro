import { prisma } from '../lib/prisma.js';
import { contains, parsePagination } from '../utils/query.js';

export async function listAuditLogs(req, res, next) {
  try {
    const { action, q } = req.query || {};
    const { page, pageSize, skip, take } = parsePagination(req.query, { defaultSize: 50, maxSize: 200 });
    const where = {};
    if (action && action !== 'ALL') where.action = action;
    if (q) {
      where.OR = [{ userName: contains(q) }, { details: contains(q) }];
    }
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    res.json({ logs, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}
