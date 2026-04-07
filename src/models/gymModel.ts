import prisma from '../config/db';

export interface GymData {
  name: string;
  email?: string;
  address?: string;
  phone: string;
}

export class GymModel {
  static async create(data: GymData) {
    return prisma.gym.create({
      data: {
        name: data.name,
        email: data.email || null,
        address: data.address || null,
        phone: data.phone,
      },
    });
  }

  static async findById(id: number) {
    return prisma.gym.findUnique({ where: { id } });
  }

  static async findAll() {
    return prisma.gym.findMany();
  }
}
