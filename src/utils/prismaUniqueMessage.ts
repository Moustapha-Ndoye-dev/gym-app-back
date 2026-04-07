/**
 * Libellé utilisateur pour une erreur Prisma P2002 (contrainte unique).
 */
export function messageForPrismaUniqueViolation(meta: unknown): string {
  const target = (meta as { target?: string | string[] } | undefined)?.target;
  const parts = Array.isArray(target)
    ? target.map(String)
    : target != null && String(target) !== ''
      ? [String(target)]
      : [];
  const haystack = parts.join(' ').toLowerCase();

  if (haystack.includes('username')) {
    return "Ce nom d'utilisateur n'est plus disponible. Veuillez en choisir un autre.";
  }
  if (haystack.includes('phone')) {
    return 'Ce numéro de téléphone est déjà utilisé. Veuillez en saisir un autre.';
  }
  if (haystack.includes('email')) {
    return "Cette adresse e-mail n'est plus disponible. Veuillez en utiliser une autre.";
  }
  return 'Ces informations existent déjà. Modifiez les champs concernés et réessayez.';
}
