import { Router } from 'express';
import {
  getAllSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
} from '../controllers/subscriptionController';
import { auth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import { minLenMsg, maxLenMsg } from '../validation/zodMin';
import { STRING_LIMITS } from '../validation/stringLimits';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Subscriptions
 *   description: Gestion des abonnements
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ActivityRef:
 *       type: object
 *       description: Activité liée à une formule (discipline accessible avec l'abonnement)
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *     Subscription:
 *       type: object
 *       required:
 *         - name
 *         - price
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         price:
 *           type: number
 *         features:
 *           type: string
 *         activities:
 *           type: array
 *           description: Disciplines incluses dans cette formule (renvoyé par l'API en lecture)
 *           items:
 *             $ref: '#/components/schemas/ActivityRef'
 *     SubscriptionCreateBody:
 *       type: object
 *       required:
 *         - name
 *         - price
 *       properties:
 *         name:
 *           type: string
 *           minLength: 2
 *         price:
 *           type: number
 *           exclusiveMinimum: 0
 *         features:
 *           type: string
 *           description: Détails ou liste d'avantages (texte libre, optionnel)
 *         activityIds:
 *           type: array
 *           nullable: true
 *           description: Activités de la salle liées à la formule (optionnel ; tableau vide ou absent = aucune discipline liée, utile pour les anciennes formules).
 *           items:
 *             type: integer
 *             minimum: 1
 *     SubscriptionUpdateBody:
 *       type: object
 *       required:
 *         - name
 *         - price
 *       properties:
 *         name:
 *           type: string
 *           minLength: 2
 *         price:
 *           type: number
 *           exclusiveMinimum: 0
 *         features:
 *           type: string
 *         activityIds:
 *           type: array
 *           nullable: true
 *           description: Si fourni (y compris [] ou null), remplace la liste des activités liées.
 *           items:
 *             type: integer
 *             minimum: 1
 */

/** Absent, null ou [] = aucune activité liée (abonnements historiques ou formule générique). */
const activityIdsSchema = z
  .union([z.array(z.coerce.number().int().positive()), z.null()])
  .optional()
  .transform((v) => (v == null ? [] : v));

/** Accepte absence / null / nombre (évite « string attendu, undefined reçu » côté Zod). */
const subscriptionNameSchema = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => (v == null ? '' : String(v).trim()))
  .pipe(
    z
      .string()
      .min(2, minLenMsg(2, "Le nom de l'abonnement"))
      .max(
        STRING_LIMITS.labelName.max,
        maxLenMsg(STRING_LIMITS.labelName.max, "Le nom de l'abonnement")
      )
  );

const subscriptionPriceSchema = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === undefined || v === null || v === '') return 0;
    const n = typeof v === 'number' ? v : Number(String(v).trim());
    return Number.isFinite(n) ? n : 0;
  })
  .pipe(
    z.number().positive('Le prix doit être un nombre strictement supérieur à 0.')
  );

const subscriptionFeaturesSchema = z
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

const subscriptionCreateSchema = z.object({
  body: z.object({
    name: subscriptionNameSchema,
    price: subscriptionPriceSchema,
    features: subscriptionFeaturesSchema,
    activityIds: activityIdsSchema,
  }),
});

const subscriptionUpdateActivityIdsSchema = z
  .union([z.array(z.coerce.number().int().positive()), z.null()])
  .optional();

const subscriptionUpdateSchema = z.object({
  body: z.object({
    name: subscriptionNameSchema,
    price: subscriptionPriceSchema,
    features: subscriptionFeaturesSchema,
    activityIds: subscriptionUpdateActivityIdsSchema,
  }),
});

const idSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "L'ID doit être un nombre"),
  }),
});

router.use(auth);
router.use(requireRole(['admin', 'cashier']));

/**
 * @swagger
 * /api/subscriptions:
 *   get:
 *     summary: Récupérer tous les abonnements
 *     description: Chaque élément peut inclure la liste `activities` (disciplines liées à la formule).
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des abonnements
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Subscription'
 */
router.get('/', getAllSubscriptions);

/**
 * @swagger
 * /api/subscriptions:
 *   post:
 *     summary: Créer un abonnement
 *     description: Le champ `activityIds` est optionnel (vide ou null = aucune activité). Réponse 400 si des IDs ne sont pas valides pour cette salle.
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubscriptionCreateBody'
 */
router.post('/', validate(subscriptionCreateSchema), createSubscription);

/**
 * @swagger
 * /api/subscriptions/{id}:
 *   put:
 *     summary: Modifier un abonnement
 *     description: Le champ `activityIds` est optionnel ; s'il est envoyé (y compris [] ou null), il remplace les liens existants.
 *     tags: [Subscriptions]
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
 *             $ref: '#/components/schemas/SubscriptionUpdateBody'
 */
router.put(
  '/:id',
  validate(idSchema),
  validate(subscriptionUpdateSchema),
  updateSubscription
);

/**
 * @swagger
 * /api/subscriptions/{id}:
 *   delete:
 *     summary: Supprimer un abonnement
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.delete('/:id', validate(idSchema), deleteSubscription);

export default router;
