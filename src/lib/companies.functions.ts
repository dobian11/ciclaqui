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
    // Server-side only: client updates of profiles.company_id are blocked by a
    // DB trigger to prevent joining an entity you don't belong to.
    await supabaseAdmin.from("profiles").update({ company_id: company.id }).eq("id", userId);

    // Create the initial review record + admin notification
    const { data: review } = await supabaseAdmin
      .from("company_reviews")
      .insert({
        company_id: company.id,
        kind: "initial",
        status: "pending",
        submitted_by: userId,
        notes: "Registrazione iniziale",
      })
      .select("id")
      .single();

    await supabaseAdmin.from("admin_notifications").insert({
      type: "company_review_submitted",
      title: `Nuova richiesta di approvazione (${company.kind === "municipality" ? "Comune" : "Azienda"})`,
      body: `${company.name} ha inviato la richiesta di registrazione.`,
      company_id: company.id,
      payload: { review_id: review?.id ?? null, kind: "initial" },
    });

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
    const { data: ownsCompany } = await supabase.rpc("owns_company", {
      _company_id: profile.company_id,
    });
    if (!ownsCompany) throw new Error("Accesso riservato al titolare dell'ente");

    // Sensitive columns (iban, vat, contact_email, ...) are not granted to the
    // authenticated role; read them through the admin client after verifying
    // the caller is associated with that company.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, name, code, vat, iban, contact_email, created_at, kind, tracking_start, tracking_end, tracking_days, status, approved_at, rejection_reason")
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
    const { data: ownsCompany } = await supabase.rpc("owns_company", {
      _company_id: profile.company_id,
    });
    if (!ownsCompany) throw new Error("Accesso riservato al titolare dell'ente");
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
    // Ogni membro dell'ente deve poter leggere la finestra di tracking del
    // PROPRIO ente (orari + nome): non è dato sensibile e serve all'auto-start.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("tracking_start, tracking_end, tracking_days, name, kind")
      .eq("id", profile.company_id)
      .maybeSingle();
    return company ?? null;
  });


// ---------------- Reviews / Resubmission ----------------

const documentSchema = z.object({
  name: z.string().min(1).max(200),
  path: z.string().min(1).max(500),
  size: z.number().int().nonnegative().optional(),
  content_type: z.string().max(120).optional(),
});

const requestReviewSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
  documents: z.array(documentSchema).max(20).default([]),
});

/**
 * Il manager invia una richiesta di nuova revisione (dopo un rifiuto o
 * volontariamente). Crea un record `company_reviews` in stato `pending`,
 * riporta `companies.status` a `pending`, e crea una notifica per l'admin.
 */
export const requestCompanyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => requestReviewSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (!profile?.company_id) throw new Error("Nessuna azienda associata");
    const { data: ownsCompany } = await supabase.rpc("owns_company", {
      _company_id: profile.company_id,
    });
    if (!ownsCompany) throw new Error("Accesso riservato al titolare dell'ente");

    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", userId);
    if (!roles?.some((r) => r.role === "company_manager")) {
      throw new Error("Solo i gestori dell'ente possono inviare richieste");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, name, kind, status")
      .eq("id", profile.company_id)
      .maybeSingle();
    if (!company) throw new Error("Ente non trovato");

    // Insert review
    const { data: review, error: revErr } = await supabaseAdmin
      .from("company_reviews")
      .insert({
        company_id: company.id,
        kind: "resubmission",
        status: "pending",
        submitted_by: userId,
        notes: data.notes ?? null,
        documents: data.documents,
      })
      .select("id, submitted_at")
      .single();
    if (revErr || !review) throw new Error("Impossibile inviare la richiesta");

    // Move company back to pending + clear rejection reason
    await supabaseAdmin
      .from("companies")
      .update({ status: "pending", rejection_reason: null })
      .eq("id", company.id);

    // Notify admin
    await supabaseAdmin.from("admin_notifications").insert({
      type: "company_review_resubmitted",
      title: `Nuova revisione richiesta (${company.kind === "municipality" ? "Comune" : "Azienda"})`,
      body: `${company.name} ha inviato ${data.documents.length} documento/i per una nuova revisione.`,
      company_id: company.id,
      payload: { review_id: review.id, kind: "resubmission", doc_count: data.documents.length },
    });

    return { ok: true, review_id: review.id };
  });

/**
 * Storico delle revisioni dell'ente del manager corrente.
 */
export const listMyCompanyReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (!profile?.company_id) return [];
    const { data: ownsCompany } = await supabase.rpc("owns_company", {
      _company_id: profile.company_id,
    });
    if (!ownsCompany) throw new Error("Accesso riservato al titolare dell'ente");
    const { data } = await supabase
      .from("company_reviews")
      .select("id, kind, status, reason, notes, documents, submitted_at, reviewed_at")
      .eq("company_id", profile.company_id)
      .order("submitted_at", { ascending: false });
    return data ?? [];
  });

/**
 * Restituisce una URL firmata temporanea per scaricare un documento di un
 * ente. Accesso consentito al manager dell'ente o agli admin.
 */
export const getCompanyDocUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = roles?.some((r) => r.role === "admin");

    if (!isAdmin) {
      // Manager: deve appartenere alla company indicata dal primo segmento del path
      const companyId = data.path.split("/")[0];
      const { data: ownsCompany } = await supabase.rpc("owns_company", {
        _company_id: companyId,
      });
      if (!ownsCompany) throw new Error("Accesso negato");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("company-docs")
      .createSignedUrl(data.path, 60 * 10);
    if (error || !signed) throw new Error("Impossibile generare il link");

    // Audit: chi ha visualizzato il documento
    const { logCompanyAudit } = await import("@/lib/audit.server");
    await logCompanyAudit({
      company_id: data.path.split("/")[0],
      action: "document_viewed",
      actor_id: userId,
      actor_role: isAdmin ? "admin" : "company_manager",
      document_path: data.path,
      document_name: data.path.split("/").pop() ?? data.path,
    });

    return { url: signed.signedUrl };
  });

/**
 * Collega l'utente autenticato a un ente tramite codice. Usato dopo il login
 * social (Google), dove il codice non può essere passato al signup.
 */
export const joinCompanyByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => validateCodeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (roles?.some((r) => r.role === "company_manager" || r.role === "admin")) {
      return { ok: false as const, reason: "manager_cannot_join" as const };
    }

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, name, status")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();
    if (!company) return { ok: false as const, reason: "not_found" as const };
    if (company.status !== "approved") {
      return { ok: false as const, reason: "not_approved" as const };
    }

    const { data: sub } = await supabaseAdmin
      .from("company_subscriptions")
      .select("status")
      .eq("company_id", company.id)
      .maybeSingle();
    if (!sub || !["active", "trial"].includes(sub.status)) {
      return { ok: false as const, reason: "no_subscription" as const };
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.company_id) {
      return { ok: false as const, reason: "already_linked" as const };
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ company_id: company.id })
      .eq("id", userId);
    if (error) throw new Error("Impossibile collegare l'account all'ente");

    return { ok: true as const, name: company.name };
  });

/**
 * Promuove l'utente autenticato a `company_manager` quando entra dall'area
 * Aziende/Comuni con Google. Consentito solo se non è già collegato a un ente
 * e non ha già un ruolo elevato: la creazione dell'ente resta soggetta ad
 * approvazione admin.
 */
export const requestManagerRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (roles?.some((r) => r.role === "admin" || r.role === "company_manager")) {
      return { ok: true as const, alreadyManager: true };
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.company_id) {
      return { ok: false as const, reason: "already_member" as const };
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "company_manager" });
    if (error) throw new Error("Impossibile attivare l'area enti");
    return { ok: true as const, alreadyManager: false };
  });

/**
 * Allega i documenti obbligatori alla pratica iniziale dell'ente (passo 2
 * dell'onboarding). Aggiorna la review `initial` in stato pending e notifica
 * l'admin che la pratica è completa.
 */
export const submitInitialDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => requestReviewSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (!profile?.company_id) throw new Error("Nessun ente associato");
    const { data: ownsCompany } = await supabase.rpc("owns_company", {
      _company_id: profile.company_id,
    });
    if (!ownsCompany) throw new Error("Accesso riservato al titolare dell'ente");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, name, kind")
      .eq("id", profile.company_id)
      .maybeSingle();
    if (!company) throw new Error("Ente non trovato");

    const { data: review } = await supabaseAdmin
      .from("company_reviews")
      .select("id")
      .eq("company_id", company.id)
      .eq("kind", "initial")
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let reviewId = review?.id ?? null;
    if (reviewId) {
      await supabaseAdmin
        .from("company_reviews")
        .update({
          documents: data.documents,
          notes: data.notes ?? "Registrazione iniziale",
          status: "pending",
        })
        .eq("id", reviewId);
    } else {
      const { data: created } = await supabaseAdmin
        .from("company_reviews")
        .insert({
          company_id: company.id,
          kind: "initial",
          status: "pending",
          submitted_by: userId,
          notes: data.notes ?? "Registrazione iniziale",
          documents: data.documents,
        })
        .select("id")
        .single();
      reviewId = created?.id ?? null;
    }

    await supabaseAdmin.from("admin_notifications").insert({
      type: "company_review_submitted",
      title: `Documenti ricevuti (${company.kind === "municipality" ? "Comune" : "Azienda"})`,
      body: `${company.name} ha completato la registrazione con ${data.documents.length} documento/i.`,
      company_id: company.id,
      payload: { review_id: reviewId, kind: "initial", doc_count: data.documents.length },
    });

    return { ok: true as const, review_id: reviewId };
  });
