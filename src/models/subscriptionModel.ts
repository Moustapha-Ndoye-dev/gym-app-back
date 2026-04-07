import prisma from '../config/db';

export interface SubscriptionInput {
  id?: number;
  gymId?: number;
  name: string;
  price: number;
  features?: string;
}

export class SubscriptionModel {
  private static async assertActivitiesBelongToGym(
    activityIds: number[],
    gymId: number
  ): Promise<void> {
    const unique = [...new Set(activityIds)];
    if (unique.length === 0) return;
    const count = await prisma.activity.count({
      where: { gymId, id: { in: unique } },
    });
    if (count !== unique.length) {
      const err = new Error(
        "Une ou plusieurs activités sont introuvables pour cette salle."
      );
      (err as Error & { code?: string }).code = 'INVALID_ACTIVITY_IDS';
      throw err;
    }
  }

  static async findAll(gymId: number) {
    return prisma.subscription.findMany({
      where: { gymId },
      include: { activities: { select: { id: true, name: true } } },
      orderBy: { id: 'asc' },
    });
  }

  static async getById(id: number, gymId: number) {
    return prisma.subscription.findFirst({
      where: { id, gymId },
      include: { activities: { select: { id: true, name: true } } },
    });
  }

  static async create(
    data: SubscriptionInput & { gymId: number; activityIds?: number[] | null }
  ) {
    const uniqueIds = [...new Set(data.activityIds ?? [])];
    await this.assertActivitiesBelongToGym(uniqueIds, data.gymId);
    return prisma.subscription.create({
      data: {
        gymId: data.gymId,
        name: data.name,
        price: data.price,
        features: data.features || null,
        ...(uniqueIds.length > 0
          ? {
              activities: {
                connect: uniqueIds.map((id) => ({ id })),
              },
            }
          : {}),
      },
      include: { activities: { select: { id: true, name: true } } },
    });
  }

  static async update(
    id: number,
    gymId: number,
    data: SubscriptionInput & { activityIds?: number[] | null }
  ) {
    const existingSubscription = await prisma.subscription.findFirst({
      where: { id, gymId },
      select: { id: true },
    });

    if (!existingSubscription) {
      return null;
    }

    const { activityIds, ...scalar } = data;

    try {
      const updateData: {
        name: string;
        price: number;
        features: string | null;
        activities?: { set: { id: number }[] };
      } = {
        name: scalar.name,
        price: scalar.price,
        features: scalar.features ?? null,
      };

      if (activityIds !== undefined) {
        const ids = activityIds == null ? [] : activityIds;
        const uniqueIds = [...new Set(ids)];
        await this.assertActivitiesBelongToGym(uniqueIds, gymId);
        updateData.activities = {
          set: uniqueIds.map((i) => ({ id: i })),
        };
      }

      return await prisma.subscription.update({
        where: { id },
        data: updateData,
        include: { activities: { select: { id: true, name: true } } },
      });
    } catch {
      return null;
    }
  }

  static async delete(id: number, gymId: number) {
    try {
      const existingSubscription = await prisma.subscription.findFirst({
        where: { id, gymId },
        select: { id: true },
      });

      if (!existingSubscription) {
        return null;
      }

      return await prisma.subscription.delete({ where: { id } });
    } catch {
      return null;
    }
  }
}
