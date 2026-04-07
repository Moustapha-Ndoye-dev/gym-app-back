import prisma from '../config/db';

export interface Product {
  id?: number;
  gymId?: number;
  name: string;
  price: number;
  stock?: number;
  category?: string;
  photo?: string;
}

export class ProductModel {
  static async findAll(gymId: number) {
    return prisma.product.findMany({ where: { gymId } });
  }

  static async getById(id: number, gymId: number) {
    return prisma.product.findUnique({ where: { id, gymId } });
  }

  static async create(data: Product & { gymId: number }) {
    const product = await prisma.product.create({
      data: {
        gymId: data.gymId,
        name: data.name,
        price: data.price,
        stock: data.stock || 0,
        category: data.category || null,
        photo: data.photo || null,
      },
    });
    return product;
  }

  static async update(id: number, gymId: number, data: Product) {
    try {
      return await prisma.product.update({
        where: { id, gymId },
        data: {
          name: data.name,
          price: data.price,
          stock: data.stock,
          category: data.category,
          photo: data.photo,
        },
      });
    } catch {
      return null;
    }
  }

  static async delete(id: number, gymId: number) {
    try {
      return await prisma.product.delete({ where: { id, gymId } });
    } catch {
      return null;
    }
  }
}
