import { Router } from 'express';
import { login, logout, me, createUser } from '../controllers/auth.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { loginRateLimit } from '../middleware/rateLimit.js';
import { ROLES } from '../constants.js';

const router = Router();

router.post('/login', loginRateLimit, login);
router.get('/me', requireAuth, me);
router.post('/logout', requireAuth, logout);
router.post('/users', requireAuth, requireRole(ROLES.SUPERADMIN), createUser);

export default router;