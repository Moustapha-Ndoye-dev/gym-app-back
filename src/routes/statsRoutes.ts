import { Router } from 'express';
import { getDashboardStats } from '../controllers/statsController';
import { auth, rejectIfController } from '../middleware/auth';

const router = Router();

router.get('/', auth, rejectIfController, getDashboardStats);

export default router;
