import { Router } from 'express';
import { getAllLogs, verifyAccess } from '../controllers/accessController';
import { auth, requireRole } from '../middleware/auth';

const router = Router();

router.use(auth);
router.use(requireRole(['admin', 'controller']));

router.get('/logs', getAllLogs);
router.post('/verify', verifyAccess);

export default router;
