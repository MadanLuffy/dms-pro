import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants.js';
import {
  createDepartment,
  createUser,
  updateUser,
  listAdminDirectory,
} from '../controllers/admin.controller.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole(ROLES.SUPERADMIN));

router.get('/directory', listAdminDirectory);
router.post('/departments', createDepartment);
router.post('/users', createUser);
router.patch('/users/:id', updateUser);

export default router;
