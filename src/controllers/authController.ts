import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { UserModel } from '../models/userModel';
import prisma from '../config/db';
import { getJwtSecret } from '../config/security';
import { messageForPrismaUniqueViolation } from '../utils/prismaUniqueMessage';

const INVALID_CREDENTIALS_MESSAGE = 'Identifiants incorrects.';

const loadUserByIdentifier = async (identifier: string) => {
  const user = await UserModel.findByUsername(identifier);
  return user ?? (await UserModel.findByEmail(identifier));
};

const ensureLoginRoleIsAllowed = (
  role: string,
  requiredRole: string | undefined
) => {
  if (role === 'superadmin') {
    return requiredRole === 'superadmin';
  }

  return requiredRole !== 'superadmin';
};

export const login = async (req: Request, res: Response): Promise<any> => {
  const { username, password, requiredRole } = req.body;

  try {
    const user = await loadUserByIdentifier(username);

    if (!user) {
      return res.status(401).json({ message: INVALID_CREDENTIALS_MESSAGE });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: INVALID_CREDENTIALS_MESSAGE });
    }

    if (!ensureLoginRoleIsAllowed(user.role, requiredRole)) {
      return res.status(401).json({ message: INVALID_CREDENTIALS_MESSAGE });
    }

    let gymName: string | undefined;
    if (user.role !== 'superadmin') {
      const gym = await prisma.gym.findUnique({ where: { id: user.gymId } });

      if (!gym) {
        return res.status(403).json({
          message: "Cette salle n'est plus enregistree dans notre systeme.",
        });
      }

      if (gym.status === 'BLOCKED') {
        return res.status(403).json({
          message: "L'acces a cette salle est suspendu. Veuillez contacter le support.",
        });
      }

      if (gym.subscriptionEnd && new Date(gym.subscriptionEnd) < new Date()) {
        return res.status(403).json({
          message:
            'Votre abonnement a expire. Veuillez regulariser votre situation pour acceder au service.',
        });
      }

      gymName = gym.name;
    }

    const secret = getJwtSecret();
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      gymId: user.gymId,
    };
    const token = jwt.sign(payload, secret, { expiresIn: '24h' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        gymId: user.gymId,
        ...(gymName != null ? { gymName } : {}),
      },
    });
  } catch (error: any) {
    if (
      error instanceof Error &&
      error.message.includes('JWT_SECRET must be set to a non-placeholder value')
    ) {
      return res.status(500).json({
        message:
          'Configuration serveur invalide: JWT_SECRET doit etre defini correctement dans le backend.',
      });
    }

    res.status(500).json({
      message: "Une erreur s'est produite. Veuillez reessayer dans quelques instants.",
    });
  }
};

export const registerGym = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { gymName, gymPhone, adminUsername, adminPassword } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 15);

      const gym = await tx.gym.create({
        data: {
          name: gymName,
          phone: gymPhone,
          saasFee: 15000,
          status: 'ACTIVE',
          subscriptionEnd: trialEndDate,
        },
      });

      const user = await tx.user.create({
        data: {
          username: adminUsername,
          password: hashedPassword,
          role: 'admin',
          gymId: gym.id,
        },
      });

      return { gym, user };
    });

    res.status(201).json({
      message: "Salle creee avec 15 jours d'essai gratuit.",
      gym: result.gym,
      adminUserId: result.user.id,
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({
        message: messageForPrismaUniqueViolation(error.meta),
      });
    }

    console.error('registerGym:', error);
    res.status(500).json({
      message:
        "Impossible de créer la salle pour le moment (erreur serveur). Réessayez dans quelques instants.",
    });
  }
};
