import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SendTransactionalEmailInput = {
  templateName: string;
  recipientEmail: string;
  idempotencyKey?: string;
  templateData?: Record<string, unknown>;
};

/**
 * Invio email applicativa riservato agli admin.
 * Gli altri flussi passano da notify.server / enqueueAppEmail lato server.
 */
export const sendTransactionalEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: SendTransactionalEmailInput) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) throw new Error("Non autorizzato");

    if (!data.templateName) throw new Error("templateName obbligatorio");

    const { enqueueAppEmail } = await import("@/lib/email/enqueue.server");
    const res = await enqueueAppEmail({
      templateName: data.templateName,
      to: data.recipientEmail,
      templateData: data.templateData,
      idempotencyKey: data.idempotencyKey,
    });

    if (!res.ok && res.reason !== "email_suppressed") {
      throw new Error(`Invio email fallito: ${res.reason ?? "errore"}`);
    }
    return { success: res.ok, reason: res.reason };
  });
