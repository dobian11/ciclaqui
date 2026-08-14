/**
 * Rilevamento email già registrata in fase di signup.
 * Supabase, per non rivelare gli account esistenti, può rispondere senza errore
 * ma con un utente "offuscato" privo di identities: quello è il segnale.
 */
export type SignUpLike = {
  user?: { identities?: unknown[] | null } | null;
  session?: unknown;
};

export function isEmailAlreadyRegistered(
  data: SignUpLike | null | undefined,
  error?: { message?: string; code?: string } | null,
): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  if (
    error &&
    (error.code === "user_already_exists" ||
      msg.includes("already registered") ||
      msg.includes("already exists") ||
      msg.includes("already been registered"))
  ) {
    return true;
  }
  const user = data?.user;
  if (user && Array.isArray(user.identities) && user.identities.length === 0) return true;
  return false;
}

export const EMAIL_EXISTS_TITLE = "Questa email è già registrata";
export const EMAIL_EXISTS_DESCRIPTION =
  "Accedi con la tua password oppure usa \"Password dimenticata?\" per impostarne una nuova.";
