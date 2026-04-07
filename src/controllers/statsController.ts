import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';

export const getDashboardStats = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  const gymId = req.user.gymId;
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  try {
    // 1. Total Members & Monthly Growth
    const totalMembers = await prisma.member.count({ where: { gymId } });
    const membersLastMonth = await prisma.member.count({
      where: { gymId, registrationDate: { gte: firstDayOfLastMonth, lte: lastDayOfLastMonth } }
    });
    const membersThisMonth = await prisma.member.count({
      where: { gymId, registrationDate: { gte: firstDayOfMonth } }
    });
    const memberTrend = membersLastMonth > 0 
      ? `+${Math.round((membersThisMonth / membersLastMonth) * 100)}%` 
      : (membersThisMonth > 0 ? `+${membersThisMonth}` : '+0%');

    // 2. Active Subscriptions
    const activeSubscriptions = await prisma.member.count({
      where: {
        gymId,
        expiryDate: { gte: now },
      },
    });

    // 3. Tickets Sold (Total & Trend)
    const ticketsSold = await prisma.ticket.count({ where: { gymId } });
    const ticketsThisMonth = await prisma.ticket.count({
      where: { gymId, createdAt: { gte: firstDayOfMonth } }
    });
    const ticketsLastMonth = await prisma.ticket.count({
      where: { gymId, createdAt: { gte: firstDayOfLastMonth, lte: lastDayOfLastMonth } }
    });
    const ticketTrend = ticketsLastMonth > 0 
      ? `${Math.round(((ticketsThisMonth - ticketsLastMonth) / ticketsLastMonth) * 100)}%` 
      : (ticketsThisMonth > 0 ? `+${ticketsThisMonth}` : '+0%');

    // 4. Monthly Revenue (Total for current month)
    const revenueThisMonth = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        gymId,
        type: 'income',
        date: { gte: firstDayOfMonth },
      },
    });
    const revenueLastMonth = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        gymId,
        type: 'income',
        date: { gte: firstDayOfLastMonth, lte: lastDayOfLastMonth },
      },
    });
    const revVal = revenueThisMonth._sum.amount || 0;
    const lastRevVal = revenueLastMonth._sum.amount || 0;
    const revenueTrend = lastRevVal > 0 
      ? `${Math.round(((revVal - lastRevVal) / lastRevVal) * 100)}%` 
      : (revVal > 0 ? `+${revVal.toLocaleString()} CFA` : '+0%');

    // 5. Recent Members
    const recentMembers = await prisma.member.findMany({
      where: { gymId },
      orderBy: { registrationDate: 'desc' },
      take: 5,
      include: { subscription: true },
    });

    const stats = {
      members: { value: totalMembers, trend: memberTrend },
      subscriptions: { value: activeSubscriptions, trend: '+0%' }, // Simple count for now
      tickets: { value: ticketsSold, trend: ticketTrend },
      revenue: { value: revVal, trend: revenueTrend },
      recentMembers: recentMembers.map(m => ({
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        registrationDate: m.registrationDate,
        subscriptionName: m.subscription?.name || 'Aucun'
      }))
    };

    res.json(stats);
  } catch (error) {
    console.error('GetDashboardStats error:', error);
    res.status(500).json({ message: 'Erreur lors du calcul des statistiques' });
  }
};
