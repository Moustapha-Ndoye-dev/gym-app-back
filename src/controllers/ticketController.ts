import { TicketModel } from '../models/ticketModel';
import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';

export const getAllTickets = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  const tickets = await TicketModel.findAll(req.user.gymId);
  res.json(tickets);
};

export const createTicket = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  try {
    const ticket = await TicketModel.create({ ...req.body, gymId: req.user.gymId });
    res.status(201).json({ ticket, message: 'Ticket créé avec succès' });
  } catch (error: any) {
    console.error('CreateTicket error:', error);
    res.status(500).json({
      message: 'Une erreur s\'est produite lors de la création du ticket.',
    });
  }
};

export const deleteTicket = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  const id = Number.parseInt(req.params.id as string, 10);
  const ticket = await TicketModel.delete(id, req.user.gymId);
  if (!ticket) {
    return res.status(404).json({ message: 'Ticket introuvable' });
  }
  res.json({ message: 'Ticket supprimé avec succès' });
};
