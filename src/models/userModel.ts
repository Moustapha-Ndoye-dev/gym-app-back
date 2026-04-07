import prisma from '../config/db';
import bcrypt from 'bcryptjs';

const safeUserSelect = {
  id: true,
  username: true,
  role: true,
  createdAt: true,
} as const;

type UserPayload = {
  username: string;
  password: string;
  role: string;
  gymId: number;
};

export class UserModel {
  private static async belongsToGym(id: number, gymId: number) {
    return prisma.user.findFirst({
      where: {
        id,
        gymId,
        NOT: { role: 'superadmin' },
      },
      select: { id: true },
    });
  }

  static async findByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } });
  }

  static async findByEmail(email: string) {
    return prisma.user.findFirst({ where: { email } });
  }

  static async findAll(gymId: number) {
    return prisma.user.findMany({ 
      where: { 
        gymId,
        NOT: { role: 'superadmin' }
      },
      select: safeUserSelect,
    });
  }

  static async create(data: UserPayload) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    return prisma.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        role: data.role,
        gymId: data.gymId,
      },
      select: safeUserSelect,
    });
  }

  static async update(
    id: number,
    gymId: number,
    data: Partial<UserPayload> & { password?: string }
  ) {
    try {
      const user = await this.belongsToGym(id, gymId);
      if (!user) {
        return null;
      }

      const updateData: Partial<UserPayload> & { password?: string } = { ...data };
      if (data.password) {
        updateData.password = await bcrypt.hash(data.password, 10);
      }
      return await prisma.user.update({
        where: { id },
        data: updateData,
        select: safeUserSelect,
      });
    } catch {
      return null;
    }
  }

  static async delete(id: number, gymId: number) {
    try {
      const user = await this.belongsToGym(id, gymId);
      if (!user) {
        return null;
      }

      return await prisma.user.delete({
        where: { id },
      });
    } catch {
      return null;
    }
  }
}
