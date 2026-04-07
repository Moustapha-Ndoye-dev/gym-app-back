import { ActivityModel } from '../models/activityModel';
import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';

export const getAllActivities = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  try {
    const activities = await ActivityModel.findAll(req.user.gymId);
    res.json(activities);
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Erreur lors de la récupération des activités' });
  }
};

export const createActivity = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  try {
    const { name, description } = req.body;
    const activity = await ActivityModel.create({
      name,
      description,
      gymId: req.user.gymId,
    });
    res.status(201).json({ activity, message: 'Activité créée avec succès' });
  } catch (error: unknown) {
    console.error('CreateActivity error:', error);
    res.status(500).json({
      message:
        "Impossible d'enregistrer l'activité (erreur serveur ou base de données). Réessayez.",
    });
  }
};

export const updateActivity = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, description } = req.body;
    const activity = await ActivityModel.update(id, req.user.gymId, { name, description });
    if (!activity)
      return res.status(404).json({ message: 'Activité introuvable' });
    res.json({ activity, message: 'Activité mise à jour avec succès' });
  } catch (error: unknown) {
    console.error('UpdateActivity error:', error);
    res.status(500).json({
      message:
        "Impossible de mettre à jour l'activité. Réessayez ou contactez le support.",
    });
  }
};

export const deleteActivity = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id as string);
    const activity = await ActivityModel.delete(id, req.user.gymId);
    if (!activity)
      return res.status(404).json({ message: 'Activité introuvable' });
    res.json({ message: 'Activité supprimée avec succès' });
  } catch (error: unknown) {
    console.error('DeleteActivity error:', error);
    res.status(500).json({
      message:
        "Impossible de supprimer l'activité. Réessayez ou contactez le support.",
    });
  }
};