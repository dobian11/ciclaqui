// Lightweight client-side telemetry helper.
// Logs events to console (always) and persists to public.telemetry_events when signed in.
// Designed to never throw and never block the caller.
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

  try {
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user?.id ?? null;
    if (!userId) return; // skip persist when unauthenticated

    await supabase.from("telemetry_events").insert({
      user_id: userId,
      event: input.event,
      source: input.source,
      status: input.status,
      duration_ms: input.durationMs ?? null,
      error_message: input.errorMessage ?? null,
      meta: input.meta ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
      created_at: ts,
    });
  } catch {
    // swallow – telemetry must never break UX
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
