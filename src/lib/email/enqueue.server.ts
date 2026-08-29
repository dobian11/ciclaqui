/**
 * Invio email applicative dal server (senza JWT utente).
 * Rende il template registrato e lo invia tramite l'infrastruttura email
 * gestita da Lovable, registrando l'esito su `email_send_log`.
 */
import { EmailAPIError } from "@lovable.dev/email-js";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import { TEMPLATES } from "@/lib/email-templates/registry";

export type EnqueueEmailInput = {
  templateName: string;
  to: string;
  templateData?: Record<string, unknown>;
  idempotencyKey?: string;
};

export type EnqueueEmailResult = { ok: boolean; reason?: string };

async function logSend(
  templateName: string,
  recipient: string,
  status: "sent" | "suppressed" | "failed",
  errorMessage?: string,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };
    const { error } = await db.from("email_send_log").insert({
      message_id: null,
      template_name: templateName,
      recipient_email: recipient,
      status,
      error_message: errorMessage ?? null,
    });
    if (error) console.error("[email_send_log]", error);
  } catch (e) {
    console.error("[email_send_log]", e);
  }
}

export async function enqueueAppEmail(input: EnqueueEmailInput): Promise<EnqueueEmailResult> {
  const template = TEMPLATES[input.templateName];
  if (!template) return { ok: false, reason: "template_not_found" };

  const recipient = (template.to || input.to || "").trim();
  if (!recipient) return { ok: false, reason: "missing_recipient" };

  try {
    const res = await sendTemplateEmail(input.templateName, recipient, {
      templateData: (input.templateData ?? {}) as Record<string, any>,
      idempotencyKey: input.idempotencyKey,
    });

    if (!res.sent) {
      await logSend(input.templateName, recipient, "suppressed", "Recipient suppressed");
      return { ok: false, reason: "email_suppressed" };
    }

    await logSend(input.templateName, recipient, "sent");
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof EmailAPIError
        ? `${e.code}: ${e.message}`
        : e instanceof Error
          ? e.message
          : "unknown_error";
    console.error("[enqueueAppEmail]", message);
    await logSend(input.templateName, recipient, "failed", message);
    return { ok: false, reason: message };
  }
}
