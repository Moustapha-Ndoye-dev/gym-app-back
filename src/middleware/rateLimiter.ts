import rateLimit from 'express-rate-limit';

const isProduction = process.env.NODE_ENV === 'production';

const readLimit = (
  value: string | undefined,
  productionFallback: number,
  developmentFloor: number
) => {
  const parsed = Number(value);

  if (Number.isFinite(parsed) && parsed > 0) {
    return isProduction ? parsed : Math.max(parsed, developmentFloor);
  }

  return isProduction ? productionFallback : developmentFloor;
};

// Limitation globale retirée : le scanner et l’app mobile partagent souvent la même IP (NAT).
// Seule la route de connexion est protégée (voir authRoutes).

// Limiteur pour les tentatives de connexion
export const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: readLimit(process.env.LOGIN_RATE_LIMIT_MAX, 10, 1000),
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      'Trop de tentatives de connexion depuis cette IP. Reessayez dans une heure.',
  },
});
