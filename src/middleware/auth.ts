import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { getJwtSecret } from '../config/security';

export interface AuthRequest extends Request {
  user?: any;
}

const allowedRoles = new Set([
  'admin',
  'cashier',
  'controller',
  'member',
  'superadmin',
]);

const toPositiveInt = (value: unknown) => {
  const parsed =
    typeof value === 'number' ? value : Number.parseInt(String(value), 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeDecodedUser = (decoded: any) => {
  const id = toPositiveInt(decoded?.id);
  const gymId = toPositiveInt(decoded?.gymId);
  const role = typeof decoded?.role === 'string' ? decoded.role : null;
  const username =
    typeof decoded?.username === 'string' ? decoded.username : '';

  if (!id || !role || !allowedRoles.has(role)) {
    return null;
  }

  if (role !== 'superadmin' && !gymId) {
    return null;
  }

  return {
    id,
    username,
    role,
    gymId: gymId ?? 0,
  };
};

export const auth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Acces refuse.' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);
    const normalizedUser = normalizeDecodedUser(decoded);

    if (!normalizedUser) {
      return res
        .status(401)
        .json({ message: 'Session invalide. Veuillez vous reconnecter.' });
    }

    if (normalizedUser.role !== 'superadmin') {
      const gym = await prisma.gym.findUnique({
        where: { id: normalizedUser.gymId },
      });

      if (!gym) {
        return res.status(403).json({
          message: "Cette salle n'est plus enregistree dans notre systeme.",
        });
      }

      if (gym.status === 'BLOCKED') {
        return res.status(403).json({
          message:
            "L'acces a cette salle est suspendu. Veuillez contacter le support.",
        });
      }

      if (gym.subscriptionEnd && new Date(gym.subscriptionEnd) < new Date()) {
        return res.status(403).json({
          message:
            'Votre abonnement a expire. Veuillez regulariser votre situation.',
        });
      }
    }

    req.user = normalizedUser;
    next();
  } catch {
    res.status(401).json({ message: 'Session expiree ou invalide.' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Acces interdit.' });
    }
    next();
  };
};

/** Comptes « contrôleur » : uniquement /api/access (scanner + historique). */
export const rejectIfController = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.user?.role === 'controller') {
    return res.status(403).json({
      message:
        "Ce compte est réservé au contrôle d'accès. Seules les fonctions d'entrée sont autorisées.",
    });
  }
  next();
};
