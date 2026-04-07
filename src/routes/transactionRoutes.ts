import { Router } from 'express';
import {
  getAllTransactions,
  createTransaction,
  deleteTransaction,
} from '../controllers/transactionController';
import { auth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Gestion des flux financiers (Revenus/Dépenses)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Transaction:
 *       type: object
 *       required:
 *         - amount
 *         - type
 *       properties:
 *         id:
 *           type: integer
 *         amount:
 *           type: number
 *         type:
 *           type: string
 *           enum: [income, expense]
 *         description:
 *           type: string
 *         date:
 *           type: string
 *           format: date-time
 */

const transactionSchema = z.object({
  body: z.object({
    amount: z.coerce
      .number()
      .refine((n) => Number.isFinite(n), {
        message: 'Le montant doit être un nombre valide.',
      })
      .refine((n) => n > 0 || n < 0, {
        message:
          'Le montant ne peut pas être zéro (indiquez un montant positif, ou négatif pour une dépense si vous utilisez ce format).',
      }),
    type: z.enum(['income', 'expense'], {
      message: 'Le type doit être « income » (revenu) ou « expense » (dépense).',
    }),
    description: z.string().optional().or(z.literal('')),
    items: z
      .array(
        z.object({
          id: z.coerce
            .number()
            .int('L\'identifiant produit doit être un nombre entier.')
            .positive('L\'identifiant produit doit être positif.'),
          quantity: z.coerce
            .number()
            .int('La quantité doit être un nombre entier.')
            .positive('La quantité doit être au moins 1.'),
        })
      )
      .optional(),
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
 * /api/transactions:
 *   get:
 *     summary: Récupérer toutes les transactions
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', getAllTransactions);

/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Créer une transaction
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', validate(transactionSchema), createTransaction);

/**
 * @swagger
 * /api/transactions/{id}:
 *   delete:
 *     summary: Supprimer une transaction
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', validate(idSchema), deleteTransaction);

export default router;
