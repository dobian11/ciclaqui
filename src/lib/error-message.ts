/** Traduce un errore (serverFn, rete, RLS) in un messaggio leggibile in italiano. */
export function friendlyMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : ((error as { message?: string } | null)?.message ?? "");

  if (/unauthor|401|no authorization header|jwt/i.test(raw))
    return "Sessione scaduta: effettua di nuovo l'accesso.";
  if (/forbidden|403|row-level security|permission denied/i.test(raw))
    return "Non hai i permessi per questa operazione.";
  if (/not found|404/i.test(raw)) return "Contenuto non disponibile.";
  if (/failed to fetch|networkerror|network request|timeout|aborted|offline/i.test(raw))
    return "Connessione assente o lenta. Riprova tra poco.";
  if (/500|internal server|unhandled|httperror/i.test(raw))
    return "Il server ha avuto un problema. Riprova tra poco.";
  return raw.slice(0, 160) || "Si è verificato un errore. Riprova.";
}
