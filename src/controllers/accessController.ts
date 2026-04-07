import { AccessModel } from '../models/accessModel';
import { MemberModel } from '../models/memberModel';
import { TicketModel } from '../models/ticketModel';
import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';

/** Nettoie le texte renvoyé par les lecteurs QR (espaces, BOM, casse du préfixe, etc.). */
const normalizeScannedQr = (raw: string): string => {
  let s = raw
    .trim()
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
};

const prefixMatches = (qrCode: string, prefix: string) => {
  const n = prefix.length;
  return (
    qrCode.length >= n &&
    qrCode.slice(0, n).toUpperCase() === prefix.toUpperCase()
  );
};

/** Extrait l’identifiant numérique après MEMBER- ou TICKET- (préfixe insensible à la casse). */
const parseQrId = (qrCode: string, prefix: string) => {
  if (!prefixMatches(qrCode, prefix)) {
    return null;
  }

  const idPart = qrCode.slice(prefix.length).trim();
  if (!/^\d+$/.test(idPart)) {
    return null;
  }

  const parsedId = Number.parseInt(idPart, 10);
  return Number.isNaN(parsedId) ? null : parsedId;
};

const getMemberAccessResult = async (memberId: number, gymId: number) => {
  const member = await MemberModel.getById(memberId, gymId);
  if (!member) {
    return {
      foundInDb: false,
      memberId: null,
      granted: false,
      message: 'Membre introuvable ou non autorisé',
      memberData: null,
    };
  }

  const now = new Date();
  const expiryDate = member.expiryDate;
  const expiryLimit = expiryDate ? new Date(expiryDate) : null;
  if (expiryLimit) {
    expiryLimit.setHours(23, 59, 59, 999);
  }
  const granted = Boolean(expiryLimit && expiryLimit >= now);
  let message = 'Aucun abonnement actif';

  if (granted) {
    message = 'Accès autorisé';
  } else if (expiryDate) {
    message = 'Abonnement expiré';
  }

  return {
    foundInDb: true,
    memberId,
    granted,
    message,
    memberData: {
      firstName: member.firstName,
      lastName: member.lastName,
      photo: member.photo,
      subscriptionName: member.subscription?.name ?? null,
      activities:
        member.subscription?.activities?.map((a) => a.name) ?? [],
    },
  };
};

const getTicketAccessResult = async (ticketId: number, gymId: number) => {
  const ticket = await TicketModel.getById(ticketId, gymId);
  if (!ticket) {
    return {
      foundInDb: false,
      ticketId: null,
      granted: false,
      message: 'Ticket introuvable ou non autorisé',
    };
  }

  if (ticket.status !== 'valid') {
    return {
      foundInDb: true,
      ticketId,
      granted: false,
      message:
        ticket.status === 'expired'
          ? 'Ticket expiré (24h dépassées)'
          : 'Ticket déjà utilisé ou expiré',
    };
  }

  const grantedScans = await AccessModel.countGrantedTicketScans(ticketId);

  if (ticket.type === 'Pass Journée') {
    if (grantedScans >= 2) {
      await TicketModel.updateStatus(ticketId, gymId, 'used');
      return {
        foundInDb: true,
        ticketId,
        granted: false,
        message: 'Pass journée déjà utilisé pour 2 séances',
      };
    }

    if (grantedScans + 1 >= 2) {
      await TicketModel.updateStatus(ticketId, gymId, 'used');
    }

    return {
      foundInDb: true,
      ticketId,
      granted: true,
      message: `Pass journée accepté (${grantedScans + 1}/2)`,
    };
  }

  if (TicketModel.isSingleUseTicket(ticket.type)) {
    await TicketModel.updateStatus(ticketId, gymId, 'used');
  }

  return {
    foundInDb: true,
    ticketId,
    granted: true,
    message: 'Ticket valide',
  };
};

export const getAllLogs = async (
  req: AuthRequest,
  res: Response
): Promise<any> => {
  try {
    const logs = await AccessModel.findAll(req.user.gymId);
    res.json(logs);
  } catch (error) {
    console.error('GetAllLogs error:', error);
    res
      .status(500)
      .json({ message: 'Erreur lors de la récupération des logs' });
  }
};

export const verifyAccess = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { qr_code } = req.body;
    let member_id: number | null = null;
    let ticket_id: number | null = null;
    let granted = false;
    let message = 'QR lu, mais code non reconnu';
    let memberData = null;
    let foundInDb = false;
    let scannedCode = '';

    if (typeof qr_code === 'string') {
      scannedCode = normalizeScannedQr(qr_code);
      const memberId = parseQrId(scannedCode, 'MEMBER-');
      const ticketId = parseQrId(scannedCode, 'TICKET-');

      if (memberId !== null) {
        const result = await getMemberAccessResult(memberId, req.user.gymId);
        foundInDb = result.foundInDb;
        member_id = result.memberId;
        granted = result.granted;
        message = result.message;
        memberData = result.memberData;
      } else if (ticketId !== null) {
        const result = await getTicketAccessResult(ticketId, req.user.gymId);
        foundInDb = result.foundInDb;
        ticket_id = result.ticketId;
        granted = result.granted;
        message = result.message;
      }

      if (
        !foundInDb &&
        !prefixMatches(scannedCode, 'MEMBER-') &&
        !prefixMatches(scannedCode, 'TICKET-')
      ) {
        message = 'QR lu, mais ce code n’appartient pas au système';
      }
    }

    if (foundInDb) {
      await AccessModel.create(
        member_id,
        ticket_id,
        granted ? 'granted' : 'denied'
      );
    }

    res.json({ granted, message, member: memberData, scannedCode });
  } catch (error) {
    console.error('VerifyAccess error:', error);
    res.status(500).json({ message: 'Erreur lors de la vérification' });
  }
};
