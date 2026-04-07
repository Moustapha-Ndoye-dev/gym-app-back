import { Request, Response, NextFunction } from 'express';
import { ZodObject, ZodSchema, ZodError } from 'zod';

/** Zod v4 + locale FR : formulations variables, on détecte par motifs larges. */
function isCrypticZodTypeError(raw: string): boolean {
  const m = raw.normalize('NFKC');
  if (/invalid_type|invalid type|Invalid type/i.test(m)) return true;
  if (/Entrée invalide/i.test(m)) return true;
  if (/expected string|reçu undefined|string attendu|undefined reçu/i.test(m))
    return true;
  if (
    /reçu|received/i.test(m) &&
    /attendu|expected/i.test(m) &&
    /string|chaîne/i.test(m)
  )
    return true;
  return false;
}

const FIELD_TYPE_HINTS: Record<string, string> = {
  name: 'Indiquez un nom valide (obligatoire, au moins 2 caractères).',
  price: 'Indiquez un prix valide, nombre strictement supérieur à 0.',
  features: 'La description doit être un texte valide.',
  description: 'La description doit être un texte valide.',
  activityIds: 'La liste des activités est invalide.',
};

/** Libellé pour l’UI : messages Zod cryptiques remplacés par des phrases claires. */
function summarizeZodIssues(issues: ZodError['issues']): string {
  const parts = issues.map((e) => {
    const joined = e.path.map(String).join('.');
    const field = joined.replace(/^(body|query|params)\./, '');
    const raw = e.message?.trim() || 'valeur invalide';

    if (isCrypticZodTypeError(raw)) {
      if (field && FIELD_TYPE_HINTS[field]) return FIELD_TYPE_HINTS[field];
      return field
        ? `Le champ « ${field} » est manquant ou dans un format non reconnu.`
        : 'Certaines données sont manquantes ou dans un format non reconnu.';
    }

    const detail = raw;
    return field ? `${field} : ${detail}` : detail;
  });
  return parts.join(' · ') || 'Données invalides';
}

export const validate =
  (schema: ZodObject<any, any> | ZodSchema) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = (await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })) as any;

      if (parsed.body) req.body = parsed.body;
      if (parsed.query) Object.assign(req.query, parsed.query);
      if (parsed.params) Object.assign(req.params, parsed.params);
      next();
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        console.log(
          '[AUTH-DEV] Validation Failed:',
          JSON.stringify(err.issues, null, 2)
        );
        const message = summarizeZodIssues(err.issues);
        return res.status(400).json({
          message,
          errors: err.issues.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      console.error('Validation middleware error:', err);
      return res
        .status(500)
        .json({
          message: 'Erreur interne de validation',
          error: err instanceof Error ? err.message : err,
        });
    }
  };
