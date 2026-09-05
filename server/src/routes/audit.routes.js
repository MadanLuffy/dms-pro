import { Router } from 'express';
import { listAuditLogs } from '../controllers/audit.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole(ROLES.SUPERADMIN, ROLES.CEO));
router.get('/', listAuditLogs);

export default router;