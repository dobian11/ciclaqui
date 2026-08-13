/**
 * Invio email applicative dal server (senza JWT utente).
 * Rende il template React Email e lo accoda su `transactional_emails`,
 * esattamente come fa la route /lovable/email/transactional/send ma
 * utilizzabile da qualsiasi server function con service role.
 */
import * as React from "react";
import { render } from "@react-email/render";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "ciclaqui";
const SENDER_DOMAIN = "notify.ciclaqui.it";
const FROM_DOMAIN = "ciclaqui.it";

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type EnqueueEmailInput = {
  templateName: string;
  to: string;
  templateData?: Record<string, unknown>;
  idempotencyKey?: string;
};

export type EnqueueEmailResult = { ok: boolean; reason?: string };

export async function enqueueAppEmail(input: EnqueueEmailInput): Promise<EnqueueEmailResult> {
  const template = TEMPLATES[input.templateName];
  if (!template) return { ok: false, reason: "template_not_found" };

  const recipient = (template.to || input.to || "").trim();
  if (!recipient) return { ok: false, reason: "missing_recipient" };
  const normalized = recipient.toLowerCase();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as {
    from: (t: string) => any;
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>;
  };

  const messageId = crypto.randomUUID();

  try {
    // 1. Suppressione (fail-closed)
    const { data: suppressed, error: supErr } = await db
      .from("suppressed_emails")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();
    if (supErr) return { ok: false, reason: "suppression_check_failed" };
    if (suppressed) return { ok: false, reason: "email_suppressed" };

    // 2. Token di disiscrizione (uno per indirizzo)
    let unsubscribeToken: string;
    const { data: existing } = await db
      .from("email_unsubscribe_tokens")
      .select("token, used_at")
      .eq("email", normalized)
      .maybeSingle();

    if (existing && !existing.used_at) {
      unsubscribeToken = existing.token as string;
    } else if (!existing) {
      unsubscribeToken = generateToken();
      await db
        .from("email_unsubscribe_tokens")
        .upsert({ token: unsubscribeToken, email: normalized }, { onConflict: "email", ignoreDuplicates: true });
      const { data: stored } = await db
        .from("email_unsubscribe_tokens")
        .select("token")
        .eq("email", normalized)
        .maybeSingle();
      if (!stored?.token) return { ok: false, reason: "token_failed" };
      unsubscribeToken = stored.token as string;
    } else {
      return { ok: false, reason: "email_suppressed" };
    }

    // 3. Render
    const data = input.templateData ?? {};
    const element = React.createElement(template.component, data as Record<string, unknown>);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject =
      typeof template.subject === "function" ? template.subject(data as Record<string, any>) : template.subject;

    await db.from("email_send_log").insert({
      message_id: messageId,
      template_name: input.templateName,
      recipient_email: recipient,
      status: "pending",
    });

    const { error: enqueueError } = await db.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: recipient,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: input.templateName,
        idempotency_key: input.idempotencyKey ?? messageId,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      await db.from("email_send_log").insert({
        message_id: messageId,
        template_name: input.templateName,
        recipient_email: recipient,
        status: "failed",
        error_message: "Failed to enqueue email",
      });
      return { ok: false, reason: "enqueue_failed" };
    }

    return { ok: true };
  } catch (e) {
    console.error("[enqueueAppEmail]", e);
    return { ok: false, reason: e instanceof Error ? e.message : "unknown_error" };
  }
}
