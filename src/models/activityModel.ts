import prisma from '../config/db';

export interface Activity {
  id?: number;
  gymId?: number;
  name: string;
  description?: string;
}

export class ActivityModel {
  static async findAll(gymId: number) {
    return prisma.activity.findMany({ where: { gymId } });
  }

  static async getById(id: number, gymId: number) {
    return prisma.activity.findFirst({ where: { id, gymId } });
  }

  static async create(data: Activity & { gymId: number }) {
    return prisma.activity.create({
      data: {
        gymId: data.gymId,
        name: data.name,
        description: data.description || null,
      },
    });
  }

  static async update(id: number, gymId: number, data: Activity) {
    try {
      const existingActivity = await prisma.activity.findFirst({
        where: { id, gymId },
        select: { id: true },
      });

      if (!existingActivity) {
        return null;
      }

      return await prisma.activity.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description || null,
        },
      });
    } catch {
      return null;
    }
  }

  static async delete(id: number, gymId: number) {
    try {
      const existingActivity = await prisma.activity.findFirst({
        where: { id, gymId },
        select: { id: true },
      });

      if (!existingActivity) {
        return null;
      }

      return await prisma.activity.delete({ where: { id } });
    } catch {
      return null;
    }
  }
}
