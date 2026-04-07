import { Router } from 'express';
import { login, registerGym } from '../controllers/authController';
import { validate } from '../middleware/validate';
import { loginLimiter } from '../middleware/rateLimiter';
import { z } from 'zod';
import { minLenMsg, maxLenMsg } from '../validation/zodMin';
import { STRING_LIMITS } from '../validation/stringLimits';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Gestion de l'authentification
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Login:
 *       type: object
 *       required:
 *         - username
 *         - password
 *       properties:
 *         username:
 *           type: string
 *         password:
 *           type: string
 *         requiredRole:
 *           type: string
 *           enum: [user, superadmin]
 *     GymRegister:
 *       type: object
 *       required:
 *         - gymName
 *         - gymPhone
 *         - adminUsername
 *         - adminPassword
 *       properties:
 *         gymName:
 *           type: string
 *         gymPhone:
 *           type: string
 *         adminUsername:
 *           type: string
 *         adminPassword:
 *           type: string
 */

const loginSchema = z.object({
  body: z.object({
    username: z
      .string()
      .min(3, minLenMsg(3, "L'identifiant de connexion"))
      .max(
        STRING_LIMITS.username.max,
        maxLenMsg(STRING_LIMITS.username.max, "L'identifiant de connexion")
      ),
    password: z
      .string()
      .min(5, minLenMsg(5, 'Le mot de passe'))
      .max(
        STRING_LIMITS.password.max,
        maxLenMsg(STRING_LIMITS.password.max, 'Le mot de passe')
      ),
    requiredRole: z.string().optional(),
  }),
});

const registerGymSchema = z.object({
  body: z.object({
    gymName: z
      .string()
      .min(2, minLenMsg(2, 'Le nom de la salle'))
      .max(
        STRING_LIMITS.gymName.max,
        maxLenMsg(STRING_LIMITS.gymName.max, 'Le nom de la salle')
      ),
    gymPhone: z
      .string()
      .min(8, minLenMsg(8, 'Le numéro de téléphone'))
      .max(
        STRING_LIMITS.phone.max,
        maxLenMsg(STRING_LIMITS.phone.max, 'Le numéro de téléphone')
      ),
    adminUsername: z
      .string()
      .min(3, minLenMsg(3, "Le nom d'utilisateur administrateur"))
      .max(
        STRING_LIMITS.username.max,
        maxLenMsg(
          STRING_LIMITS.username.max,
          "Le nom d'utilisateur administrateur"
        )
      ),
    adminPassword: z
      .string()
      .min(5, minLenMsg(5, 'Le mot de passe administrateur'))
      .max(
        STRING_LIMITS.password.max,
        maxLenMsg(STRING_LIMITS.password.max, 'Le mot de passe administrateur')
      ),
  }),
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Connecter un utilisateur
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Login'
 *     responses:
 *       200:
 *         description: Succès de la connexion
 *       401:
 *         description: Identifiants incorrects
 */
router.post('/login', loginLimiter, validate(loginSchema), login);

/**
 * @swagger
 * /api/auth/register-gym:
 *   post:
 *     summary: Enregistrer une nouvelle salle de gym
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GymRegister'
 */
router.post('/register-gym', validate(registerGymSchema), registerGym);

export default router;
