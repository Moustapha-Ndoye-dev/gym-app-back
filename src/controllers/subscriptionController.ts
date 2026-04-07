import { SubscriptionModel } from '../models/subscriptionModel';
import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';

export const getAllSubscriptions = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  try {
    const subscriptions = await SubscriptionModel.findAll(req.user.gymId);
    res.json(subscriptions);
  } catch (error) {
    console.error('GetAllSubscriptions error:', error);
    res
      .status(500)
      .json({ message: 'Erreur lors de la récupération des abonnements' });
  }
};

export const createSubscription = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  try {
    const { name, price, features, activityIds } = req.body;
    const subscription = await SubscriptionModel.create({
      name,
      price,
      features: features ?? '',
      activityIds:
        activityIds == null
          ? []
          : Array.isArray(activityIds)
            ? activityIds
            : [],
      gymId: req.user.gymId,
    });
    res
      .status(201)
      .json({ subscription, message: 'Abonnement créé avec succès' });
  } catch (error: unknown) {
    if ((error as Error & { code?: string }).code === 'INVALID_ACTIVITY_IDS') {
      return res.status(400).json({ message: (error as Error).message });
    }
    console.error('CreateSubscription error:', error);
    res.status(500).json({
      message: "Une erreur s'est produite lors de la création de l'abonnement.",
    });
  }
};

export const updateSubscription = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, price, features, activityIds } = req.body;
    const subscription = await SubscriptionModel.update(id, req.user.gymId, {
      name,
      price,
      features: features ?? '',
      ...(activityIds !== undefined
        ? {
            activityIds:
              activityIds == null
                ? []
                : Array.isArray(activityIds)
                  ? activityIds
                  : [],
          }
        : {}),
    });
    if (!subscription)
      return res.status(404).json({ message: 'Abonnement introuvable' });
    res.json({ subscription, message: 'Abonnement mis à jour avec succès' });
  } catch (error: unknown) {
    if ((error as Error & { code?: string }).code === 'INVALID_ACTIVITY_IDS') {
      return res.status(400).json({ message: (error as Error).message });
    }
    res.status(500).json({ message: 'Erreur lors de la mise à jour' });
  }
};

export const deleteSubscription = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id as string);
    const subscription = await SubscriptionModel.delete(id, req.user.gymId);
    if (!subscription)
      return res.status(404).json({ message: 'Abonnement introuvable' });
    res.json({ message: 'Abonnement supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression' });
  }
};
