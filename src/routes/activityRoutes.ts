import { Router } from 'express';
import {
  getAllActivities,
  createActivity,
  updateActivity,
  deleteActivity,
} from '../controllers/activityController';
import { auth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import { minLenMsg, maxLenMsg } from '../validation/zodMin';
import { STRING_LIMITS } from '../validation/stringLimits';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Activities
 *   description: Gestion des activités sportives
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Activity:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         description:
 *           type: string
 */

const activityNameSchema = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => (v == null ? '' : String(v).trim()))
  .pipe(
    z
      .string()
      .min(2, minLenMsg(2, "Le nom de l'activité"))
      .max(
        STRING_LIMITS.labelName.max,
        maxLenMsg(STRING_LIMITS.labelName.max, "Le nom de l'activité")
      )
  );

const activityDescriptionSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null ? '' : String(v)))
  .pipe(
    z
      .string()
      .max(
        STRING_LIMITS.description.max,
        maxLenMsg(STRING_LIMITS.description.max, 'La description')
      )
  );

const activitySchema = z.object({
  body: z.object({
    name: activityNameSchema,
    description: activityDescriptionSchema,
  }),
});

const idSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "L'ID doit être un nombre"),
  }),
});

router.use(auth);

/**
 * @swagger
 * /api/activities:
 *   get:
 *     summary: Récupérer toutes les activités
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des activités
 */
router.get('/', requireRole(['admin', 'cashier']), getAllActivities);

router.use(requireRole(['admin']));

/**
 * @swagger
 * /api/activities:
 *   post:
 *     summary: Créer une activité
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Activity'
 *     responses:
 *       201:
 *         description: Activité créée
 */
router.post('/', validate(activitySchema), createActivity);

/**
 * @swagger
 * /api/activities/{id}:
 *   put:
 *     summary: Modifier une activité
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Activity'
 */
router.put(
  '/:id',
  validate(idSchema),
  validate(activitySchema),
  updateActivity
);

/**
 * @swagger
 * /api/activities/{id}:
 *   delete:
 *     summary: Supprimer une activité
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.delete('/:id', validate(idSchema), deleteActivity);

export default router;
