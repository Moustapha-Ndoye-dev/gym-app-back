import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { minLenMsg, maxLenMsg } from '../validation/zodMin';
import { STRING_LIMITS } from '../validation/stringLimits';
import { 
  getSuperStats, 
  getAllGyms, 
  createGymWithAdmin, 
  updateGym, 
  deleteGym, 
  getAllSuperAdmins, 
  createSuperAdmin, 
  deleteSuperAdmin,
  getAllSuperSubscriptions,
  createSuperSubscription,
  updateSuperSubscription,
  deleteSuperSubscription
} from '../controllers/superAdminController';
import { auth, requireRole } from '../middleware/auth';

const router = Router();

const createSuperAdminSchema = z.object({
  body: z.object({
    username: z
      .string()
      .min(3, minLenMsg(3, "Le nom d'utilisateur"))
      .max(
        STRING_LIMITS.username.max,
        maxLenMsg(STRING_LIMITS.username.max, "Le nom d'utilisateur")
      ),
    password: z
      .string()
      .min(5, minLenMsg(5, 'Le mot de passe'))
      .max(
        STRING_LIMITS.password.max,
        maxLenMsg(STRING_LIMITS.password.max, 'Le mot de passe')
      ),
    email: z
      .union([
        z.literal(''),
        z
          .string()
          .max(
            STRING_LIMITS.email.max,
            maxLenMsg(STRING_LIMITS.email.max, "L'e-mail")
          )
          .email("L'adresse e-mail n'est pas valide."),
      ])
      .optional(),
  }),
});

router.use(auth);
router.use(requireRole(['superadmin']));

// Stats
router.get('/stats', getSuperStats);

// Gyms
router.get('/gyms', getAllGyms);
router.post('/gyms', createGymWithAdmin);
router.put('/gyms/:id', updateGym);
router.delete('/gyms/:id', deleteGym);

// Admins
router.get('/admins', getAllSuperAdmins);
router.post('/admins', validate(createSuperAdminSchema), createSuperAdmin);
router.delete('/admins/:id', deleteSuperAdmin);

// Subscriptions (SaaS Plans)
router.get('/subscriptions', getAllSuperSubscriptions);
router.post('/subscriptions', createSuperSubscription);
router.put('/subscriptions/:id', updateSuperSubscription);
router.delete('/subscriptions/:id', deleteSuperSubscription);

export default router;
