import { Router } from 'express';
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/productController';
import { auth, requireRole, rejectIfController } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import { minLenMsg, maxLenMsg } from '../validation/zodMin';
import { STRING_LIMITS } from '../validation/stringLimits';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Gestion de la boutique
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
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
 *         stock:
 *           type: integer
 *         category:
 *           type: string
 */

const productSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, minLenMsg(2, 'Le nom du produit'))
      .max(
        STRING_LIMITS.labelName.max,
        maxLenMsg(STRING_LIMITS.labelName.max, 'Le nom du produit')
      ),
    price: z.coerce
      .number()
      .positive('Le prix doit être un nombre strictement supérieur à 0.'),
    stock: z.coerce
      .number()
      .int('Le stock doit être un nombre entier.')
      .min(0, 'Le stock ne peut pas être négatif.')
      .optional(),
    category: z
      .string()
      .max(
        STRING_LIMITS.productCategory.max,
        maxLenMsg(STRING_LIMITS.productCategory.max, 'La catégorie')
      )
      .optional(),
    photo: z.string().optional(),
  }),
});

const idSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "L'ID doit être un nombre"),
  }),
});

router.use(auth);
router.use(rejectIfController);

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Récupérer les produits
 *     tags: [Products]
 */
router.get('/', getAllProducts);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Détails d'un produit
 *     tags: [Products]
 */
router.get('/:id', validate(idSchema), getProductById);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Créer un produit (Admin)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/',
  requireRole(['admin']),
  validate(productSchema),
  createProduct
);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Modifier un produit (Admin)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  '/:id',
  requireRole(['admin']),
  validate(idSchema),
  validate(productSchema),
  updateProduct
);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Supprimer un produit (Admin)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/:id',
  requireRole(['admin']),
  validate(idSchema),
  deleteProduct
);

export default router;
