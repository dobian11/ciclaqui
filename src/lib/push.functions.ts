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

    const { sendPushToUsers } = await import("@/lib/push.server");
    return await sendPushToUsers({
      userIds: [data.targetUserId],
      title: data.title,
      body: data.body,
      data: data.data,
    });
  });
