import { TransactionModel } from '../models/transactionModel';
import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';

export const getAllTransactions = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  try {
    const transactions = await TransactionModel.findAll(req.user.gymId);
    res.json(transactions);
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Erreur lors de la recuperation des transactions' });
  }
};

export const createTransaction = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  try {
    const transaction = await TransactionModel.create({
      ...req.body,
      gymId: req.user.gymId,
      userId: req.user.id,
    });

    res.status(201).json({ transaction, message: 'Transaction enregistree' });
  } catch (error: any) {
    if (
      error.code === 'PRODUCT_NOT_FOUND' ||
      error.code === 'INSUFFICIENT_STOCK'
    ) {
      return res.status(400).json({ message: error.message });
    }

    console.error('createTransaction:', error);
    res.status(500).json({
      message:
        "Impossible d'enregistrer la transaction (vente ou caisse). Réessayez ; en cas d'échec répété, vérifiez le stock des produits.",
    });
  }
};

export const deleteTransaction = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id as string);
    const transaction = await TransactionModel.delete(id, req.user.gymId);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction introuvable' });
    }
    res.json({ message: 'Transaction supprimee' });
  } catch (error) {
    console.error('deleteTransaction:', error);
    res.status(500).json({
      message:
        'Impossible de supprimer cette transaction. Réessayez ou contactez le support.',
    });
  }
};
