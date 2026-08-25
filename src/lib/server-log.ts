/**
 * Logger strutturato per le server function (runtime Worker).
 *
 * - Livelli: debug / info / warn / error.
 * - Una riga per evento, prefisso `[scope] LIVELLO messaggio {json}`:
 *   i log runtime sono filtrabili per scope e livello.
 * - Nessuna persistenza, nessun blocco: un errore di serializzazione
 *   non deve mai interrompere la business logic.
 * - Privacy: NON loggare PII (email, nomi, coordinate grezze).
 *   Passare solo identificativi troncati e metriche aggregate.
 */
export type ServerLogLevel = "debug" | "info" | "warn" | "error";

export interface ServerLogger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

function safeJson(meta: Record<string, unknown>): string {
  try {
    return JSON.stringify(meta);
  } catch {
    return '"[meta non serializzabile]"';
  }
}

export function createServerLogger(scope: string): ServerLogger {
  const emit = (level: ServerLogLevel, msg: string, meta?: Record<string, unknown>) => {
    const line = `[${scope}] ${level.toUpperCase()} ${msg}${meta ? ` ${safeJson(meta)}` : ""}`;
    try {
      if (level === "error") console.error(line);
      else if (level === "warn") console.warn(line);
      else if (level === "info") console.info(line);
      else console.debug(line);
    } catch {
      // un log non deve mai buttare giù la richiesta
    }
  };
  return {
    debug: (m, meta) => emit("debug", m, meta),
    info: (m, meta) => emit("info", m, meta),
    warn: (m, meta) => emit("warn", m, meta),
    error: (m, meta) => emit("error", m, meta),
  };
}
