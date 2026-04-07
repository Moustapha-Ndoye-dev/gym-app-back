import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import bcrypt from 'bcryptjs';
import prisma, { ensureSystemGym, SYSTEM_GYM_NAME } from '../config/db';
import { messageForPrismaUniqueViolation } from '../utils/prismaUniqueMessage';

const getTenantGymsWhere = () => ({
  name: {
    not: SYSTEM_GYM_NAME,
  },
});

const getSystemSubscriptionById = async (id: number) => {
  const systemGym = await ensureSystemGym();

  return prisma.subscription.findFirst({
    where: {
      id,
      gymId: systemGym.id,
    },
  });
};

const toSafeSuperAdmin = (user: {
  id: number;
  username: string;
  email: string | null;
  role: string;
  createdAt: Date;
}) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
});

const parseId = (value: string) => Number.parseInt(value, 10);
const parsePrice = (value: string | number) => Number.parseFloat(String(value));

// --- STATS ---
export const getSuperStats = async (req: AuthRequest, res: Response): Promise<any> => {
  const { period = 'monthly' } = req.query;
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);

  try {
    const allGyms = await prisma.gym.findMany({
      where: getTenantGymsWhere(),
      select: { saasFee: true, createdAt: true, subscriptionEnd: true, status: true }
    });

    const totalGyms = allGyms.length;
    const totalMembers = await prisma.member.count();
    
    // Inscriptions du mois
    const newGymsThisMonth = allGyms.filter(g => new Date(g.createdAt) >= firstDayOfMonth).length;

    // Répartition Trial vs Paying
    const payingGyms = allGyms.filter(gym => {
      if (!gym.subscriptionEnd) return false;
      const trialEnd = new Date(gym.createdAt);
      trialEnd.setDate(trialEnd.getDate() + 15);
      return new Date(gym.subscriptionEnd) > trialEnd;
    });

    const payingGymsCount = payingGyms.length;
    const trialGymsCount = totalGyms - payingGymsCount;

    // Taux de conversion (Approximatif: payants / total)
    const conversionRate = totalGyms > 0 ? Math.round((payingGymsCount / totalGyms) * 100) : 0;

    // Alertes expirations (dans les 30 prochains jours)
    const expiringSoonCount = allGyms.filter(g => 
      g.subscriptionEnd && 
      new Date(g.subscriptionEnd) > now && 
      new Date(g.subscriptionEnd) <= thirtyDaysFromNow
    ).length;

    // REVENUS RÉELS (Basés sur les contrats activés)
    const monthlyRevenue = payingGyms.reduce((acc, gym) => acc + (gym.saasFee || 0), 0);
    
    // Calcul selon la période sélectionnée (Mensuel, Semestriel, Annuel)
    let saasRevenue = monthlyRevenue;
    if (period === 'semestriel') saasRevenue = monthlyRevenue * 6;
    else if (period === 'annuel') saasRevenue = monthlyRevenue * 12;

    // HISTORIQUE RÉEL (Basé sur les dates d'activation et de création)
    interface MonthData { name: string; month: number; year: number; revenue: number; }
    const months: MonthData[] = [];
    const historyCount = period === 'annuel' ? 12 : 6;

    for (let i = historyCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        name: d.toLocaleDateString('fr-FR', { month: 'short' }),
        month: d.getMonth(),
        year: d.getFullYear(),
        revenue: 0
      });
    }

    // On parcourt chaque mois de l'historique pour calculer le revenu réel à cet instant T
    months.forEach(m => {
      const monthStart = new Date(m.year, m.month, 1);
      const monthEnd = new Date(m.year, m.month + 1, 0);
      
      payingGyms.forEach(gym => {
        const createdAt = new Date(gym.createdAt);
        const subscriptionEnd = gym.subscriptionEnd ? new Date(gym.subscriptionEnd) : null;
        
        // On affiche le revenu si la salle existait durant ce mois 
        // ET qu'elle est considérée comme payante (déjà vérifié par le filtre payingGyms)
        if (createdAt <= monthEnd && (!subscriptionEnd || subscriptionEnd >= monthStart)) {
          m.revenue += (gym.saasFee || 0);
        }
      });
    });

    res.json({
      stats: {
        totalGyms,
        payingGymsCount,
        trialGymsCount,
        newGymsThisMonth,
        conversionRate,
        expiringSoonCount,
        totalMembers,
        saasRevenue,
        revenueHistory: months.map(m => ({ name: m.name, revenue: m.revenue }))
      }
    });
  } catch (error) {
    console.error('SuperStats error:', error);
    res.status(500).json({ message: 'Erreur stats' });
  }
};

// --- GYMS ---
export const getAllGyms = async (req: AuthRequest, res: Response) => {
  try {
    const gyms = await prisma.gym.findMany({
      where: getTenantGymsWhere(),
      include: {
        _count: {
          select: {
            members: true,
            transactions: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(gyms);
  } catch (error) {
    console.error('GetAllGyms error:', error);
    res.status(500).json({ message: 'Erreur chargement salles' });
  }
};

export const createGymWithAdmin = async (req: AuthRequest, res: Response): Promise<any> => {
  const { name, phone, adminUsername, adminPassword, saasFee } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 15);

    const result = await prisma.$transaction(async (tx) => {
      const gym = await tx.gym.create({
        data: { name, phone, saasFee: saasFee || 15000, status: 'ACTIVE', subscriptionEnd: trialEnd }
      });
      await tx.user.create({
        data: { username: adminUsername, password: hashedPassword, role: 'admin', gymId: gym.id }
      });
      return gym;
    });
    res.status(201).json(result);
  } catch (error: any) {
    console.error('CreateGymWithAdmin error:', error);
    if (error?.code === 'P2002') {
      return res.status(400).json({
        message: messageForPrismaUniqueViolation(error.meta),
      });
    }
    res.status(500).json({ message: 'Erreur création salle' });
  }
};

export const updateGym = async (req: AuthRequest, res: Response): Promise<any> => {
  const { id } = req.params;
  const { name, email, status, saasFee, subscriptionEnd } = req.body;
  try {
    await prisma.gym.update({
      where: { id: parseId(id as string) },
      data: { 
        name, 
        email, 
        status, 
        saasFee: saasFee ? parsePrice(saasFee) : undefined,
        subscriptionEnd: subscriptionEnd ? new Date(subscriptionEnd) : undefined
      }
    });
    res.json({ message: 'Salle mise à jour' });
  } catch (error: any) {
    console.error('UpdateGym error:', error);
    if (error?.code === 'P2002') {
      return res.status(400).json({
        message: messageForPrismaUniqueViolation(error.meta),
      });
    }
    res.status(500).json({ message: 'Erreur mise à jour' });
  }
};

export const deleteGym = async (req: AuthRequest, res: Response): Promise<any> => {
  const { id } = req.params;
  try {
    await prisma.gym.delete({ where: { id: parseId(id as string) } });
    res.json({ message: 'Salle supprimée' });
  } catch (error) {
    console.error('DeleteGym error:', error);
    res.status(500).json({ message: 'Erreur suppression' });
  }
};

// --- SUPER ADMINS ---
export const getAllSuperAdmins = async (req: AuthRequest, res: Response) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'superadmin' },
      select: { id: true, username: true, email: true, createdAt: true, role: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(admins);
  } catch (error) {
    console.error('GetAllSuperAdmins error:', error);
    res.status(500).json({ message: 'Erreur chargement admins' });
  }
};

export const createSuperAdmin = async (req: AuthRequest, res: Response): Promise<any> => {
  const { username, password, email } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const systemGym = await ensureSystemGym();

    if (!systemGym) return res.status(400).json({ message: 'Le système n\'est pas encore initialisé (aucune salle trouvée).' });

    // Force role to be 'superadmin' regardless of what's sent in the body
    const user = await prisma.user.create({
      data: { 
        username, 
        password: hashedPassword, 
        email, 
        role: 'superadmin', 
        gymId: systemGym.id 
      }
    });
    res.status(201).json(toSafeSuperAdmin(user));
  } catch (error: any) {
    console.error('CreateSuperAdmin error:', error);
    if (error?.code === 'P2002') {
      return res.status(400).json({
        message: messageForPrismaUniqueViolation(error.meta),
      });
    }
    res.status(500).json({ message: 'Erreur création superadmin' });
  }
};

export const deleteSuperAdmin = async (req: AuthRequest, res: Response): Promise<any> => {
  const { id } = req.params;
  try {
    if (parseId(id as string) === req.user.id) return res.status(400).json({ message: 'Auto-suppression impossible' });
    await prisma.user.delete({ where: { id: parseId(id as string) } });
    res.json({ message: 'SuperAdmin supprimé' });
  } catch (error) {
    console.error('DeleteSuperAdmin error:', error);
    res.status(500).json({ message: 'Erreur suppression' });
  }
};

// --- SAAS SUBSCRIPTIONS (Plans) ---
export const getAllSuperSubscriptions = async (req: AuthRequest, res: Response) => {
  try {
    const systemGym = await ensureSystemGym();
    const plans = await prisma.subscription.findMany({
      where: { gymId: systemGym.id },
      orderBy: { name: 'asc' },
    });
    res.json(plans);
  } catch (error) {
    console.error('GetAllSuperSubscriptions error:', error);
    res.status(500).json({ message: 'Erreur plans' });
  }
};

export const createSuperSubscription = async (req: AuthRequest, res: Response): Promise<any> => {
  const { name, price, features } = req.body;
  try {
    const systemGym = await ensureSystemGym();
    const plan = await prisma.subscription.create({
      data: {
        name,
        price: parsePrice(price),
        features,
        gymId: systemGym.id,
      }
    });
    res.status(201).json(plan);
  } catch (error) {
    console.error('CreateSuperSubscription error:', error);
    res.status(500).json({ message: 'Erreur création plan' });
  }
};

export const updateSuperSubscription = async (req: AuthRequest, res: Response): Promise<any> => {
  const { id } = req.params;
  const { name, price, features } = req.body;
  try {
    const existingPlan = await getSystemSubscriptionById(parseId(id as string));
    if (!existingPlan) {
      return res.status(404).json({ message: 'Plan introuvable' });
    }

    await prisma.subscription.update({
      where: { id: existingPlan.id },
      data: { name, price: parsePrice(price), features }
    });
    res.json({ message: 'Plan mis à jour' });
  } catch (error) {
    console.error('UpdateSuperSubscription error:', error);
    res.status(500).json({ message: 'Erreur mise à jour' });
  }
};

export const deleteSuperSubscription = async (req: AuthRequest, res: Response): Promise<any> => {
  const { id } = req.params;
  try {
    const existingPlan = await getSystemSubscriptionById(parseId(id as string));
    if (!existingPlan) {
      return res.status(404).json({ message: 'Plan introuvable' });
    }

    await prisma.subscription.delete({ where: { id: existingPlan.id } });
    res.json({ message: 'Plan supprimé' });
  } catch (error) {
    console.error('DeleteSuperSubscription error:', error);
    res.status(500).json({ message: 'Erreur suppression' });
  }
};
