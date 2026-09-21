import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Invio push tramite FCM HTTP v1 (Android + iOS). Richiede il secret
 * FCM_SERVICE_ACCOUNT_JSON; senza secret ritorna { configured: false }.
 */
export const sendPushToUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetUserId: string; title: string; body: string; data?: Record<string, string> }) => input)
  .handler(async ({ data, context }) => {
    // Solo admin, oppure il titolare/gestore dell'ente a cui appartiene il destinatario.
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) {
      const { data: isManager } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "company_manager",
      });
      if (!isManager) throw new Error("Forbidden");

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: target } = await supabaseAdmin
        .from("profiles")
        .select("company_id")
        .eq("id", data.targetUserId)
        .maybeSingle();
      if (!target?.company_id) throw new Error("Forbidden");

      const { data: owns } = await context.supabase.rpc("owns_company", {
        _company_id: target.company_id,
      });
      if (!owns) throw new Error("Forbidden");
    }

    const { sendPushToUsers } = await import("@/lib/push.server");
    return await sendPushToUsers({
      userIds: [data.targetUserId],
      title: data.title,
      body: data.body,
      data: data.data,
    });
  });

/** Stato dell'integrazione push per l'utente corrente (secret + device registrati). */
export const getPushDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const configured = Boolean(process.env["FCM_SERVICE_ACCOUNT_JSON"]);
    const { data } = await context.supabase
      .from("device_tokens")
      .select("platform, last_seen")
      .eq("user_id", context.userId);
    const devices = (data ?? []) as { platform: string | null; last_seen: string | null }[];
    return {
      configured,
      devices: devices.map((d) => ({
        platform: d.platform ?? "unknown",
        lastSeen: d.last_seen,
      })),
    };
  });

/** Invia una push di prova ai dispositivi dell'utente corrente. */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendPushToUsers } = await import("@/lib/push.server");
    return await sendPushToUsers({
      userIds: [context.userId],
      title: "Cicla Qui",
      body: "Notifiche push attive: ci siamo! 🚲",
      data: { url: "/app/notifiche", type: "test" },
    });
  });
