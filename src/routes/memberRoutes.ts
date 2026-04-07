import { Router } from 'express';
import {
  getAllMembers,
  createMember,
  updateMember,
  deleteMember,
} from '../controllers/memberController';
import { auth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import { minLenMsg, maxLenMsg } from '../validation/zodMin';
import { STRING_LIMITS } from '../validation/stringLimits';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Members
 *   description: Gestion des adhérents (Adhérents)
 */

const memberSchema = z.object({
  body: z.object({
    firstName: z
      .string()
      .min(2, minLenMsg(2, 'Le prénom'))
      .max(
        STRING_LIMITS.personName.max,
        maxLenMsg(STRING_LIMITS.personName.max, 'Le prénom')
      )
      .optional(),
    lastName: z
      .string()
      .min(2, minLenMsg(2, 'Le nom de famille'))
      .max(
        STRING_LIMITS.personName.max,
        maxLenMsg(STRING_LIMITS.personName.max, 'Le nom de famille')
      )
      .optional(),
    phone: z
      .string()
      .max(
        STRING_LIMITS.memberPhone.max,
        maxLenMsg(STRING_LIMITS.memberPhone.max, 'Le téléphone')
      )
      .optional(),
    email: z
      .union([
        z.literal(''),
        z
          .string()
          .max(
            STRING_LIMITS.email.max,
            maxLenMsg(STRING_LIMITS.email.max, "L'e-mail")
          )
          .email("L'adresse e-mail n'est pas valide (ex. nom@domaine.fr)."),
      ])
      .optional(),
    photo: z.string().optional(),
    subscriptionId: z.coerce
      .number()
      .int("L'abonnement doit être un nombre entier.")
      .positive('Choisissez un abonnement valide (identifiant positif).')
      .optional(),
    durationMonths: z.coerce
      .number()
      .int('La durée en mois doit être un nombre entier.')
      .positive('La durée doit être d\'au moins 1 mois.')
      .optional(),
    expiryDate: z.string().optional(),
    registrationDate: z.string().optional(),
  }),
});

const updateMemberSchema = memberSchema.partial();

const idSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "L'ID doit être un nombre"),
  }),
});

router.use(auth);
router.use(requireRole(['admin', 'cashier']));

/**
 * @swagger
 * /api/members:
 *   get:
 *     summary: Récupérer tous les membres
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', getAllMembers);

/**
 * @swagger
 * /api/members:
 *   post:
 *     summary: Créer un nouveau membre
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', validate(memberSchema), createMember);

/**
 * @swagger
 * /api/members/{id}:
 *   put:
 *     summary: Mettre à jour un membre
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  '/:id',
  validate(idSchema),
  validate(updateMemberSchema),
  updateMember
);

/**
 * @swagger
 * /api/members/{id}:
 *   delete:
 *     summary: Supprimer un membre
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', validate(idSchema), deleteMember);

export default router;
