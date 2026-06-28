import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Invio push tramite FCM HTTP v1. Richiede secret FCM_SERVICE_ACCOUNT_JSON.
 * Stub: ritorna {configured:false} finché il secret non è impostato.
 */
export const sendPushToUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetUserId: string; title: string; body: string; data?: Record<string, string> }) => input)
  .handler(async ({ data, context }) => {
    const sa = process.env.FCM_SERVICE_ACCOUNT_JSON;
    if (!sa) return { configured: false as const };

    // Solo admin o stessa company
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) {
      // controllo company manager → stessa company del target
      const { data: caller } = await context.supabase.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
      const { data: target } = await context.supabase.from("profiles").select("company_id").eq("id", data.targetUserId).maybeSingle();
      if (!caller?.company_id || caller.company_id !== target?.company_id) {
        throw new Error("Forbidden");
      }
    }

    const { data: tokens } = await context.supabase
      .from("device_tokens")
      .select("token, platform")
      .eq("user_id", data.targetUserId);

    if (!tokens?.length) return { sent: 0, configured: true as const };

    // Implementazione FCM HTTP v1: scambio JWT → access_token → POST messages:send
    // (stub: per ora ritorna conteggio, l'integrazione completa viene attivata appena
    //  il service account è configurato e firebase project pronto)
    return { sent: tokens.length, configured: true as const, stub: true };
  });
