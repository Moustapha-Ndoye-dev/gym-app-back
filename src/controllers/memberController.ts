import { MemberModel } from '../models/memberModel';
import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';
import { messageForPrismaUniqueViolation } from '../utils/prismaUniqueMessage';

export const getAllMembers = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  const members = await MemberModel.findAll(req.user.gymId);
  res.json(members);
};

export const createMember = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  try {
    const member = await MemberModel.create({
      ...req.body,
      gymId: req.user.gymId,
    });

    res.status(201).json({ member, message: 'Membre cree avec succes' });
  } catch (error: any) {
    if (error.code === 'SUBSCRIPTION_NOT_FOUND') {
      return res.status(400).json({ message: error.message });
    }

    if (error.code === 'P2002') {
      return res.status(400).json({
        message: messageForPrismaUniqueViolation(error.meta),
      });
    }

    console.error('createMember:', error);
    res.status(500).json({
      message:
        "Impossible d'enregistrer l'adhérent (erreur serveur). Vérifiez l'email, l'abonnement et réessayez.",
    });
  }
};

export const updateMember = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  try {
    const id = Number.parseInt(req.params.id as string, 10);
    const member = await MemberModel.update(id, req.user.gymId, req.body);

    if (!member) {
      return res.status(404).json({ message: 'Membre introuvable' });
    }

    res.json({ member, message: 'Membre mis a jour avec succes' });
  } catch (error: any) {
    if (error.code === 'SUBSCRIPTION_NOT_FOUND') {
      return res.status(400).json({ message: error.message });
    }

    console.error('updateMember:', error);
    res.status(500).json({
      message:
        "Impossible de mettre à jour l'adhérent. Réessayez ; si le problème continue, contactez le support.",
    });
  }
};

export const deleteMember = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  const id = Number.parseInt(req.params.id as string, 10);
  const member = await MemberModel.delete(id, req.user.gymId);

  if (!member) {
    return res.status(404).json({ message: 'Membre introuvable' });
  }

  res.json({ message: 'Membre supprime avec succes' });
};
