import prisma from '../config/db';

export interface Ticket {
  id?: number;
  gymId?: number;
  type: string;
  price: number;
  status?: string | null;
  createdAt?: Date | null;
}

export class TicketModel {
  static isSingleUseTicket(type: string) {
    return type === 'Séance Unique';
  }

  private static hasExpired(ticket: Ticket) {
    const { createdAt, type } = ticket;
    if (!createdAt) {
      return true;
    }

    if (type === 'Pass Journée') {
      const expiresAt = new Date(createdAt);
      expiresAt.setHours(23, 59, 59, 999);
      return expiresAt <= new Date();
    }

    const expiresAt = new Date(createdAt);
    expiresAt.setHours(expiresAt.getHours() + 24);

    return expiresAt <= new Date();
  }

  static getEffectiveStatus(ticket: Ticket) {
    if (this.hasExpired(ticket)) {
      return 'expired';
    }

    const dbStatus = ticket.status ?? 'valid';
    if (dbStatus !== 'valid') {
      return dbStatus;
    }

    return 'valid';
  }

  private static withEffectiveStatus<T extends Ticket>(ticket: T) {
    return {
      ...ticket,
      status: this.getEffectiveStatus(ticket),
    };
  }

  private static async belongsToGym(id: number, gymId: number) {
    return prisma.ticket.findFirst({
      where: { id, gymId },
      select: { id: true },
    });
  }

  static async findAll(gymId: number) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const tickets = await prisma.ticket.findMany({
      where: {
        gymId,
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tickets.map((ticket) => this.withEffectiveStatus(ticket));
  }

  static async getById(id: number, gymId: number) {
    const ticket = await prisma.ticket.findFirst({ where: { id, gymId } });
    return ticket ? this.withEffectiveStatus(ticket) : null;
  }

  static async create(data: Ticket & { gymId: number }) {
    return await prisma.$transaction(async (tx) => {
      // 1. Create the ticket
      const ticket = await tx.ticket.create({
        data: {
          gymId: data.gymId,
          type: data.type,
          price: data.price,
          status: 'valid',
        },
      });

      // 2. Create the financial transaction in the cash register
      await tx.transaction.create({
        data: {
          gymId: data.gymId,
          amount: data.price,
          type: 'income',
          description: `Vente Ticket: ${data.type} (#${ticket.id})`,
          date: new Date(),
        },
      });

      return ticket;
    });
  }

  static async updateStatus(id: number, gymId: number, status: string) {
    try {
      const ticket = await this.belongsToGym(id, gymId);
      if (!ticket) {
        return null;
      }

      return await prisma.ticket.update({
        where: { id },
        data: { status },
      });
    } catch {
      return null;
    }
  }

  static async delete(id: number, gymId: number) {
    try {
      const ticket = await this.belongsToGym(id, gymId);
      if (!ticket) {
        return null;
      }

      return await prisma.ticket.delete({ where: { id } });
    } catch {
      return null;
    }
  }
}
