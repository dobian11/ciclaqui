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
  /** Salva su DB gli eventi accumulati (info/warn/error) per il pannello admin. */
  flush(): Promise<void>;
}

function safeJson(meta: Record<string, unknown>): string {
  try {
    return JSON.stringify(meta);
  } catch {
    return '"[meta non serializzabile]"';
  }
}

type PendingRow = {
  user_id: string | null;
  event: string;
  source: string;
  status: string;
  error_message: string | null;
  meta: Record<string, unknown> | null;
};

export function createServerLogger(
  scope: string,
  options?: { userId?: string | null },
): ServerLogger {
  const pending: PendingRow[] = [];

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
    // Il livello debug resta solo nei log runtime: in DB finisce
    // ciò che serve alla diagnostica admin.
    if (level === "debug") return;
    pending.push({
      user_id: options?.userId ?? null,
      event: `${scope}:${msg}`,
      source: "server",
      status: level,
      error_message: level === "error" ? msg : null,
      meta: meta ? { ...meta, scope, level } : { scope, level },
    });
  };

  return {
    debug: (m, meta) => emit("debug", m, meta),
    info: (m, meta) => emit("info", m, meta),
    warn: (m, meta) => emit("warn", m, meta),
    error: (m, meta) => emit("error", m, meta),
    async flush() {
      if (pending.length === 0) return;
      const rows = pending.splice(0, pending.length);
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("telemetry_events").insert(rows as never);
      } catch {
        // la diagnostica non deve mai far fallire la richiesta
      }
    },
  };
}

