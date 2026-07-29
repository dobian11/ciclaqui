import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Registro invii email di decisione (approvazione/rifiuto ente).
 * Visibile all'admin (tutti) e ai membri/gestori dell'ente (solo i propri) via RLS.
 */
export const logCompanyDecisionEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        company_id: z.string().uuid(),
        review_id: z.string().uuid().optional().nullable(),
        recipient_email: z.string().email(),
        decision: z.enum(["approved", "rejected"]),
        status: z.enum(["sent", "failed"]),
        error_message: z.string().max(500).optional().nullable(),
        idempotency_key: z.string().max(200).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("company_email_log").insert({
      company_id: data.company_id,
      review_id: data.review_id ?? null,
      template_name: "company-decision",
      decision: data.decision,
      recipient_email: data.recipient_email,
      status: data.status,
      error_message: data.error_message ?? null,
      idempotency_key: data.idempotency_key ?? null,
      sent_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Elenco degli invii; se company_id è omesso vengono restituiti quelli visibili (admin: tutti). */
export const listCompanyEmailLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ company_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("company_email_log")
      .select(
        "id, company_id, review_id, template_name, decision, recipient_email, status, error_message, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.company_id) q = q.eq("company_id", data.company_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows ?? []).map((r) => r.company_id)));
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: comps } = await context.supabase
        .from("companies")
        .select("id, name")
        .in("id", ids);
      names = Object.fromEntries((comps ?? []).map((c) => [c.id, c.name]));
    }

    return (rows ?? []).map((r) => ({ ...r, company_name: names[r.company_id] ?? null }));
  });
