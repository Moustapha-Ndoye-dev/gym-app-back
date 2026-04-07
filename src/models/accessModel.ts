import prisma from '../config/db';

export class AccessModel {
  static async findAll(gymId: number, limit: number = 50) {
    return prisma.accessLog.findMany({
      where: {
        OR: [{ member: { gymId } }, { ticket: { gymId } }],
      },
      take: limit,
      orderBy: { accessTime: 'desc' },
      select: {
        id: true,
        accessTime: true,
        status: true,
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photo: true,
          },
        },
        ticket: {
          select: {
            id: true,
            type: true,
            status: true,
          },
        },
      },
    });
  }

  static async create(
    member_id: number | null,
    ticket_id: number | null,
    status: string
  ) {
    return prisma.accessLog.create({
      data: {
        memberId: member_id,
        ticketId: ticket_id,
        status: status,
      },
    });
  }

  static async countGrantedTicketScans(ticketId: number) {
    return prisma.accessLog.count({
      where: {
        ticketId,
        status: 'granted',
      },
    });
  }
}
