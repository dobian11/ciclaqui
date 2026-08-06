// Lightweight client-side telemetry helper.
// Logs events to console (always) and persists to public.telemetry_events when signed in.
// Designed to never throw and never block the caller.
// Gli eventi sono accodati e inviati in batch per non generare una insert
// per ogni interazione (che rallentava mappa e navigazione).
import { supabase } from "@/integrations/supabase/client";

export type TelemetrySource = "poi" | "air_quality" | "gps" | "live" | "all";
export type TelemetryStatus = "success" | "error" | "cancelled" | "start";

export interface TelemetryEventInput {
  event: string;            // e.g. "refresh"
  source: TelemetrySource;  // origin sub-system
  status: TelemetryStatus;
  durationMs?: number;
  errorMessage?: string | null;
  meta?: Record<string, unknown>;
}

const COLOR = {
  success: "color:#10b981",
  error: "color:#ef4444",
  cancelled: "color:#f59e0b",
  start: "color:#60a5fa",
} as const;

const FLUSH_DELAY_MS = 8_000;
const MAX_BUFFER = 20;

type Row = Record<string, unknown>;

let buffer: Row[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let cachedUserId: string | null | undefined;
let listenersBound = false;

async function getUserId(): Promise<string | null> {
  if (cachedUserId !== undefined) return cachedUserId;
  try {
    const { data } = await supabase.auth.getSession();
    cachedUserId = data.session?.user?.id ?? null;
  } catch {
    cachedUserId = null;
  }
  return cachedUserId;
}

function bindListeners() {
  if (listenersBound || typeof document === "undefined") return;
  listenersBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushTelemetry();
  });
  window.addEventListener("pagehide", () => void flushTelemetry());
  supabase.auth.onAuthStateChange((_e, session) => {
    cachedUserId = session?.user?.id ?? null;
  });
}

export async function flushTelemetry(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  try {
    const userId = await getUserId();
    if (!userId) return;
    await supabase
      .from("telemetry_events")
      .insert(batch.map((r) => ({ ...r, user_id: userId })) as never);
  } catch {
    // swallow – telemetry must never break UX
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushTelemetry();
  }, FLUSH_DELAY_MS);
}

export async function logTelemetry(input: TelemetryEventInput): Promise<void> {
  const ts = new Date().toISOString();
  try {
    // Console trace for live debugging
    // eslint-disable-next-line no-console
    console.log(
      `%c[telemetry] ${input.event}/${input.source} %c${input.status}` +
        (input.durationMs != null ? ` (${input.durationMs}ms)` : ""),
      "color:#94a3b8",
      COLOR[input.status],
      input.errorMessage ?? "",
      input.meta ?? "",
    );
  } catch {}

  // Gli eventi "start" servono solo al debug live: non li persistiamo.
  if (input.status === "start") return;
  if (typeof window === "undefined") return;

  bindListeners();
  buffer.push({
    event: input.event,
    source: input.source,
    status: input.status,
    duration_ms: input.durationMs ?? null,
    error_message: input.errorMessage ?? null,
    meta: (input.meta ?? null) as unknown,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
    created_at: ts,
  });

  if (buffer.length >= MAX_BUFFER || input.status === "error") {
    void flushTelemetry();
  } else {
    scheduleFlush();
  }
}

/**
 * Time an async operation and emit start/success/error events.
 */
export async function withTelemetry<T>(
  event: string,
  source: TelemetrySource,
  fn: () => Promise<T>,
  meta?: Record<string, unknown>,
): Promise<T> {
  const t0 = performance.now();
  void logTelemetry({ event, source, status: "start", meta });
  try {
    const result = await fn();
    void logTelemetry({
      event,
      source,
      status: "success",
      durationMs: Math.round(performance.now() - t0),
      meta,
    });
    return result;
  } catch (e: any) {
    void logTelemetry({
      event,
      source,
      status: "error",
      durationMs: Math.round(performance.now() - t0),
      errorMessage: e?.message ?? String(e),
      meta,
    });
    throw e;
  }
}
