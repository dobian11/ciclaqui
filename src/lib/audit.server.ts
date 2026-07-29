/**
 * Registro di audit degli enti (server-only).
 * Scrive voci immutabili in public.company_audit_log usando il client admin.
 * Non deve MAI essere importato da codice client: solo dentro handler server.
 */

export type CompanyAuditAction =
  | "document_viewed"
  | "company_approved"
  | "company_rejected"
  | "review_submitted";

export interface CompanyAuditEntry {
  company_id: string;
  action: CompanyAuditAction;
  actor_id?: string | null;
  actor_role?: string | null;
  document_name?: string | null;
  document_path?: string | null;
  review_id?: string | null;
  reason?: string | null;
  details?: Record<string, unknown>;
}

/**
 * Inserisce una voce nel registro. Non lancia mai: un errore di logging
 * non deve bloccare l'operazione principale (download o decisione).
 */
export async function logCompanyAudit(entry: CompanyAuditEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let actorName: string | null = null;
    if (entry.actor_id) {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", entry.actor_id)
        .maybeSingle();
      actorName = data?.full_name ?? null;
    }

    await supabaseAdmin.from("company_audit_log").insert({
      company_id: entry.company_id,
      action: entry.action,
      actor_id: entry.actor_id ?? null,
      actor_name: actorName,
      actor_role: entry.actor_role ?? null,
      document_name: entry.document_name ?? null,
      document_path: entry.document_path ?? null,
      review_id: entry.review_id ?? null,
      reason: entry.reason ?? null,
      details: (entry.details ?? {}) as never,
    });
  } catch (e) {
    console.error("[audit] impossibile registrare la voce:", e);
  }
}
