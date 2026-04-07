import { UserModel } from '../models/userModel';
import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';
import { messageForPrismaUniqueViolation } from '../utils/prismaUniqueMessage';

export const getAllUsers = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  try {
    const users = await UserModel.findAll(req.user.gymId);
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération' });
  }
};

export const createUser = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  try {
    const user = await UserModel.create({ ...req.body, gymId: req.user.gymId });
    res.status(201).json({ user, message: 'Utilisateur créé' });
  } catch (error: any) {
    console.error('createUser:', error);
    if (error?.code === 'P2002') {
      return res.status(400).json({
        message: messageForPrismaUniqueViolation(error.meta),
      });
    }
    res.status(500).json({
      message:
        "Impossible de créer l'utilisateur. Vérifiez les champs et réessayez.",
    });
  }
};

export const updateUser = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id as string);
    const user = await UserModel.update(id, req.user.gymId, req.body);
    if (!user) return res.status(404).json({ message: 'Non trouvé' });
    res.json({ user, message: 'Utilisateur mis à jour' });
  } catch (error: any) {
    console.error('updateUser:', error);
    if (error?.code === 'P2002') {
      return res.status(400).json({
        message: messageForPrismaUniqueViolation(error.meta),
      });
    }
    res.status(500).json({
      message:
        "Impossible de mettre à jour l'utilisateur. Réessayez ou contactez le support.",
    });
  }
};

export const deleteUser = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id as string);
    const user = await UserModel.delete(id, req.user.gymId);
    if (!user) return res.status(404).json({ message: 'Non trouvé' });
    res.json({ message: 'Utilisateur supprimé' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression' });
  }
};
