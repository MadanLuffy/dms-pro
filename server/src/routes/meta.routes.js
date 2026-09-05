import { Router } from 'express';
import { listDepartments, listUsers } from '../controllers/meta.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/departments', listDepartments);
router.get('/users', listUsers);

export default router;