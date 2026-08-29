import { sendTransactionalEmailFn } from "@/lib/email/send.functions";

export type SendTransactionalEmailInput = {
  templateName: string;
  recipientEmail: string;
  idempotencyKey?: string;
  templateData?: Record<string, unknown>;
};

/**
 * Invia un'email applicativa (solo admin) tramite server function.
 */
export async function sendTransactionalEmail(input: SendTransactionalEmailInput) {
  return await sendTransactionalEmailFn({ data: input });
}
