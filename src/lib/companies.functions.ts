import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const createCompanySchema = z.object({
  name: z.string().trim().min(2, "Nome troppo corto").max(120),
  vat: z.string().trim().max(32).optional().or(z.literal("")),
  iban: z.string().trim().max(34).optional().or(z.literal("")),
  contact_email: z.string().trim().email().max(255),
  kind: z.enum(["company", "municipality"]).default("company"),
});

/**
 * Crea un'azienda per l'utente attualmente autenticato e gli assegna il ruolo
 * `company_manager`. Genera un codice azienda univoco lato server.
 *
 * Uso: dopo signup, il manager chiama questa funzione per registrare la propria
 * azienda. Sicurezza: l'utente deve essere autenticato; viene legato a
 * `companies.created_by = auth.uid()`.
 */
export const createCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createCompanySchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Use service role to generate the code (function is privileged) and to
    // grant the company_manager role to the caller.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: codeData, error: codeErr } = await supabaseAdmin.rpc(
      "generate_company_code",
      { _name: data.name },
    );
    if (codeErr || !codeData) {
      console.error("[createCompany] generate_company_code failed", codeErr);
      throw new Error("Impossibile generare il codice azienda");
    }

    // Insert company as the user (RLS lets admin only INSERT, so we use admin
    // client and explicitly set created_by).
    const { data: company, error: insertErr } = await supabaseAdmin
      .from("companies")
      .insert({
        name: data.name,
        vat: data.vat || null,
        iban: data.iban || null,
        contact_email: data.contact_email,
        code: codeData,
        created_by: userId,
        kind: data.kind,
      })
      .select()
      .single();

    if (insertErr || !company) {
      console.error("[createCompany] insert failed", insertErr);
      throw new Error("Impossibile creare l'azienda");
    }

    // Grant company_manager role
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "company_manager" }, { onConflict: "user_id,role" });

    // Link the manager's profile to the company (so they appear in their own
    // company in queries that filter by company_id).
    await supabase.from("profiles").update({ company_id: company.id }).eq("id", userId);

    return { id: company.id, code: company.code, name: company.name, kind: company.kind };
  });

/**
 * Verifica se un codice azienda è valido (chiamata pubblica usata dal form di
 * signup utente per dare feedback prima del submit).
 */
const validateCodeSchema = z.object({
  code: z.string().trim().min(3).max(20),
});

export const validateCompanyCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => validateCodeSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, name, status")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();
    if (!company) return { valid: false as const, reason: "not_found" as const };
    if (company.status !== "approved") {
      return { valid: false as const, reason: "not_approved" as const };
    }
    const { data: sub } = await supabaseAdmin
      .from("company_subscriptions")
      .select("status")
      .eq("company_id", company.id)
      .maybeSingle();
    if (!sub || !["active", "trial"].includes(sub.status)) {
      return { valid: false as const, reason: "no_subscription" as const };
    }
    return { valid: true as const, name: company.name };
  });

/**
 * Ritorna l'azienda dell'utente autenticato (se è company_manager o membro).
 * Include numero dipendenti e stato abbonamento.
 */
export const getMyCompany = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.company_id) return null;

    const { data: company } = await supabase
      .from("companies")
      .select("id, name, code, vat, iban, contact_email, created_at, kind, tracking_start, tracking_end, tracking_days")
      .eq("id", profile.company_id)
      .maybeSingle();

    if (!company) return null;

    const [{ count: employees }, { data: sub }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id),
      supabase
        .from("company_subscriptions")
        .select("status, current_period_end, plan")
        .eq("company_id", company.id)
        .maybeSingle(),
    ]);

    return {
      ...company,
      employees_count: employees ?? 0,
      subscription: sub ?? null,
    };
  });

const trackingWindowSchema = z.object({
  tracking_start: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable(),
  tracking_end: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable(),
  tracking_days: z.array(z.number().int().min(0).max(6)).max(7),
});

/**
 * Aggiorna la finestra oraria di tracking dell'azienda/comune del manager.
 * Solo i company_manager possono modificare la propria azienda.
 */
export const updateTrackingWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => trackingWindowSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (!profile?.company_id) throw new Error("Nessuna azienda associata");
    const { error } = await supabase
      .from("companies")
      .update({
        tracking_start: data.tracking_start,
        tracking_end: data.tracking_end,
        tracking_days: data.tracking_days,
      })
      .eq("id", profile.company_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Restituisce la finestra di tracking dell'azienda/comune dell'utente loggato.
 * Usata dall'app per decidere se avviare il tracking automatico.
 */
export const getMyTrackingWindow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (!profile?.company_id) return null;
    const { data: company } = await supabase
      .from("companies")
      .select("tracking_start, tracking_end, tracking_days, name, kind")
      .eq("id", profile.company_id)
      .maybeSingle();
    return company ?? null;
  });

