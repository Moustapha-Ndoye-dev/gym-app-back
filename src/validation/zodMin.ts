/**
 * Message explicite pour les règles Zod `.min(n)` : indique toujours le nombre minimum requis.
 */
export function minLenMsg(min: number, fieldLabel: string): string {
  const unit = min > 1 ? 'caractères' : 'caractère';
  return `${fieldLabel} : il faut saisir au minimum ${min} ${unit}.`;
}

/** Message pour `.max(n)` sur les chaînes. */
export function maxLenMsg(max: number, fieldLabel: string): string {
  return `${fieldLabel} : ${max} caractères maximum.`;
}
