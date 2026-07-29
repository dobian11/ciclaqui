import { supabase } from "@/integrations/supabase/client";

export type SendTransactionalEmailInput = {
  templateName: string;
  recipientEmail: string;
  idempotencyKey?: string;
  templateData?: Record<string, unknown>;
};

/**
 * Invia un'email applicativa tramite la route interna di Lovable Emails.
 * Richiede una sessione autenticata (il JWT viene allegato automaticamente).
 */
export async function sendTransactionalEmail(input: SendTransactionalEmailInput) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessione non valida");

  const res = await fetch("/lovable/email/transactional/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Invio email fallito [${res.status}]: ${body}`);
  }
  return (await res.json()) as { success?: boolean; reason?: string };
}
