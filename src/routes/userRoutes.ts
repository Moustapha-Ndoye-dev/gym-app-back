import { Router } from 'express';
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/userController';
import { auth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import { minLenMsg, maxLenMsg } from '../validation/zodMin';
import { STRING_LIMITS } from '../validation/stringLimits';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Gestion des utilisateurs (Admin seulement)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     UserCreate:
 *       type: object
 *       required:
 *         - username
 *         - password
 *         - role
 *       properties:
 *         username:
 *           type: string
 *         password:
 *           type: string
 *         role:
 *           type: string
 *           enum: [admin, cashier, controller, member]
 *     UserUpdate:
 *       type: object
 *       properties:
 *         username:
 *           type: string
 *         password:
 *           type: string
 *         role:
 *           type: string
 *           enum: [admin, cashier, controller, member]
 */

const createUserSchema = z.object({
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
    role: z.enum(['admin', 'cashier', 'controller', 'member'], {
      message:
        'Le rôle doit être admin, cashier (caisse), controller (contrôle) ou member.',
    }),
  }),
});

const updateUserSchema = z.object({
  body: z.object({
    username: z
      .string()
      .min(3, minLenMsg(3, "Le nom d'utilisateur"))
      .max(
        STRING_LIMITS.username.max,
        maxLenMsg(STRING_LIMITS.username.max, "Le nom d'utilisateur")
      )
      .optional(),
    password: z
      .union([
        z.literal(''),
        z
          .string()
          .min(5, minLenMsg(5, 'Le mot de passe'))
          .max(
            STRING_LIMITS.password.max,
            maxLenMsg(STRING_LIMITS.password.max, 'Le mot de passe')
          ),
      ])
      .optional(),
    role: z
      .enum(['admin', 'cashier', 'controller', 'member'], {
        message:
          'Le rôle doit être admin, cashier, controller ou member.',
      })
      .optional(),
  }),
});

const idSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "L'ID doit être un nombre"),
  }),
});

router.use(auth);
router.use(requireRole(['admin'])); // Only admins can manage users

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Liste des utilisateurs
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', getAllUsers);

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Créer un utilisateur
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserCreate'
 */
router.post('/', validate(createUserSchema), createUser);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Modifier un utilisateur
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdate'
 */
router.put('/:id', validate(idSchema), validate(updateUserSchema), updateUser);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Supprimer un utilisateur
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', validate(idSchema), deleteUser);

export default router;
