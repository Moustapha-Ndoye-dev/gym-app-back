import prisma from '../config/db';

type MemberPayload = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  registrationDate?: string;
  expiryDate?: string | Date | null;
  subscriptionId?: number;
  photo?: string;
  gymId: number;
  durationMonths?: number;
};

export class MemberModel {
  private static async belongsToGym(id: number, gymId: number) {
    return prisma.member.findFirst({
      where: { id, gymId },
      select: { id: true },
    });
  }

  private static async requireGymSubscription(
    tx: Pick<typeof prisma, 'subscription'>,
    subscriptionId: number,
    gymId: number
  ) {
    const subscription = await tx.subscription.findFirst({
      where: {
        id: subscriptionId,
        gymId,
      },
    });

    if (!subscription) {
      const error = new Error('Abonnement introuvable pour cette salle.');
      (error as Error & { code?: string }).code = 'SUBSCRIPTION_NOT_FOUND';
      throw error;
    }

    return subscription;
  }

  static async findAll(gymId: number) {
    return prisma.member.findMany({
      where: { gymId },
      include: {
        subscription: {
          include: {
            activities: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { registrationDate: 'desc' },
    });
  }

  static async getById(id: number, gymId: number) {
    return prisma.member.findFirst({
      where: { id, gymId },
      include: {
        subscription: {
          include: {
            activities: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  static async create(data: MemberPayload) {
    return await prisma.$transaction(async (tx) => {
      let expiryDate = null;
      let amount = 0;

      if (data.subscriptionId) {
        const sub = await this.requireGymSubscription(
          tx,
          data.subscriptionId,
          data.gymId
        );
        const duration = data.durationMonths || 1;
        amount = sub.price * duration;
        expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + duration);
      }

      const { durationMonths, ...memberData } = data;
      const member = await tx.member.create({
        data: {
          ...memberData,
          expiryDate,
        },
      });

      if (amount > 0) {
        await tx.transaction.create({
          data: {
            gymId: data.gymId,
            amount,
            type: 'income',
            description: `Abonnement initial pour ${data.firstName || ''} ${data.lastName || ''}`,
            date: new Date(),
          },
        });
      }

      return member;
    });
  }

  static async update(id: number, gymId: number, data: Partial<MemberPayload>) {
    try {
      const member = await this.belongsToGym(id, gymId);
      if (!member) {
        return null;
      }

      if (
        Object.hasOwn(data, 'subscriptionId') &&
        data.subscriptionId
      ) {
        await this.requireGymSubscription(prisma, data.subscriptionId, gymId);
      }

      return await prisma.member.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (
        (error as Error & { code?: string }).code ===
        'SUBSCRIPTION_NOT_FOUND'
      ) {
        throw error;
      }
      return null;
    }
  }

  static async delete(id: number, gymId: number) {
    try {
      const member = await this.belongsToGym(id, gymId);
      if (!member) {
        return null;
      }

      return await prisma.member.delete({
        where: { id },
      });
    } catch {
      return null;
    }
  }
}
