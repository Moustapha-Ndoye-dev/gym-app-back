import prisma from '../config/db';

type TransactionItem = {
  id: number;
  quantity: number;
};

const buildTransactionError = (code: string, message: string) => {
  const error = new Error(message) as Error & { code?: string };
  error.code = code;
  return error;
};

export class TransactionModel {
  static async findAll(gymId: number) {
    return prisma.transaction.findMany({
      where: { gymId },
      orderBy: { date: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  }

  static async create(
    data: {
      amount: number;
      type: string;
      description?: string;
      userId?: number | null;
      items?: TransactionItem[];
    } & { gymId: number }
  ) {
    const items = Array.isArray(data.items) ? data.items : [];

    if (data.type !== 'income' || items.length === 0) {
      return prisma.transaction.create({
        data: {
          gymId: data.gymId,
          amount: data.amount,
          type: data.type,
          description: data.description || null,
          userId: data.userId || null,
          date: new Date(),
        },
      });
    }

    const groupedItems = items.reduce<Map<number, number>>((acc, item) => {
      acc.set(item.id, (acc.get(item.id) || 0) + item.quantity);
      return acc;
    }, new Map());

    return prisma.$transaction(async (tx) => {
      const productIds = Array.from(groupedItems.keys());
      const products = await tx.product.findMany({
        where: {
          gymId: data.gymId,
          id: { in: productIds },
        },
      });

      if (products.length !== productIds.length) {
        throw buildTransactionError(
          'PRODUCT_NOT_FOUND',
          'Un ou plusieurs produits sont introuvables pour cette salle.'
        );
      }

      const productsById = new Map(products.map((product) => [product.id, product]));

      for (const [productId, quantity] of groupedItems.entries()) {
        const product = productsById.get(productId);

        if (!product) {
          throw buildTransactionError(
            'PRODUCT_NOT_FOUND',
            'Un ou plusieurs produits sont introuvables pour cette salle.'
          );
        }

        const availableStock = product.stock ?? 0;
        if (availableStock < quantity) {
          throw buildTransactionError(
            'INSUFFICIENT_STOCK',
            `Stock insuffisant pour ${product.name}. Stock disponible: ${availableStock}.`
          );
        }
      }

      for (const [productId, quantity] of groupedItems.entries()) {
        const product = productsById.get(productId)!;
        await tx.product.update({
          where: { id: product.id, gymId: data.gymId },
          data: {
            stock: (product.stock ?? 0) - quantity,
          },
        });
      }

      return tx.transaction.create({
        data: {
          gymId: data.gymId,
          amount: data.amount,
          type: data.type,
          description: data.description || null,
          userId: data.userId || null,
          date: new Date(),
        },
      });
    });
  }

  static async delete(id: number, gymId: number) {
    try {
      return await prisma.transaction.delete({
        where: { id, gymId },
      });
    } catch {
      return null;
    }
  }
}
