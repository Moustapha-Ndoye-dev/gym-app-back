import { Router } from 'express';
import {
  getAllTickets,
  createTicket,
  deleteTicket,
} from '../controllers/ticketController';
import { auth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Tickets
 *   description: Gestion des tickets d'entrée (pass journalier)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Ticket:
 *       type: object
 *       required:
 *         - type
 *         - price
 *       properties:
 *         id:
 *           type: integer
 *         type:
 *           type: string
 *         price:
 *           type: number
 */

const ticketSchema = z.object({
  body: z.object({
    type: z.enum(['Séance Unique', 'Pass Journée'], {
      message:
        'Type de ticket invalide : choisissez « Séance Unique » ou « Pass Journée ».',
    }),
    price: z.coerce
      .number()
      .positive('Le prix du ticket doit être un nombre strictement supérieur à 0.'),
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
 * /api/tickets:
 *   get:
 *     summary: Récupérer tous les tickets
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', getAllTickets);

/**
 * @swagger
 * /api/tickets:
 *   post:
 *     summary: Créer un ticket
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', validate(ticketSchema), createTicket);

/**
 * @swagger
 * /api/tickets/{id}:
 *   delete:
 *     summary: Supprimer un ticket
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', validate(idSchema), deleteTicket);

export default router;
