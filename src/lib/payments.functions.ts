import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { validateIban } from "@/lib/iban";


/**
 * STUB Stripe Connect onboarding. Quando avremo la STRIPE_SECRET_KEY questa
 * funzione creerà un Account Express e ritornerà un onboarding link. Per ora
 * salva uno stato "pending" sul profilo.
 */
export const startConnectOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("profiles")
      .update({ stripe_account_status: "pending_stub" })
      .eq("id", userId);
    return {
      url: null as string | null,
      stub: true as const,
      message:
        "Stripe Connect non ancora configurato. Quando attiveremo le chiavi, qui partirà l'onboarding Express.",
    };
  });

/**
 * Riepilogo prelievi dell'utente: configurazione conversione (letta da
 * app_config lato server), saldo, IBAN salvato e richieste aperte.
 */
export const getPayoutSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: cfg }, { data: wallet }, { data: profile }, { data: payouts }] =
      await Promise.all([
        supabaseAdmin
          .from("app_config")
          .select("eur_per_point, payout_threshold_eur")
          .eq("id", 1)
          .maybeSingle(),
        supabase
          .from("wallets")
          .select("points_balance, eur_balance, lifetime_points")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase.from("profiles").select("iban").eq("id", userId).maybeSingle(),
        supabase
          .from("payout_requests")
          .select("points_redeemed, amount_eur, status")
          .eq("user_id", userId),
      ]);

    const eurPerPoint = Number(cfg?.eur_per_point ?? 0.01);
    const thresholdEur = Number(cfg?.payout_threshold_eur ?? 0.5);
    const minPoints = Math.max(1, Math.ceil(thresholdEur / (eurPerPoint || 0.01)));

    const points = wallet?.points_balance ?? 0;
    const all = payouts ?? [];
    const openRequest = all.some((p) => p.status === "pending" || p.status === "approved");
    const paidEur = all
      .filter((p) => p.status === "paid")
      .reduce((s, p) => s + Number(p.amount_eur), 0);

    const iban = profile?.iban ?? null;
    return {
      eur_per_point: eurPerPoint,
      threshold_eur: thresholdEur,
      min_points: minPoints,
      points_balance: points,
      eur_available: Number((points * eurPerPoint).toFixed(2)),
      missing_points: Math.max(0, minPoints - points),
      can_request: points >= minPoints && !openRequest,
      has_open_request: openRequest,
      paid_eur: Number(paidEur.toFixed(2)),
      saved_iban_masked: iban ? `${iban.slice(0, 4)}••••${iban.slice(-4)}` : null,
      has_saved_iban: !!iban,
    };
  });

/**
 * Richiesta di prelievo punti → euro. La conversione e la soglia minima sono
 * definite in app_config e applicate atomicamente dalla RPC SECURITY DEFINER
 * (scala punti dal wallet, registra la transazione e crea la richiesta).
 */
const payoutSchema = z
  .object({
    points: z.number().int().positive("Inserisci i punti da convertire"),
    iban: z.string().trim().max(42, "IBAN troppo lungo").optional(),
    use_saved_iban: z.boolean().optional(),
  })
  .transform((d) => ({
    ...d,
    iban: d.iban ? d.iban.replace(/\s+/g, "").toUpperCase() : undefined,
  }))
  .superRefine((d, ctx) => {
    if (d.use_saved_iban) return;
    if (!d.iban) {
      ctx.addIssue({ code: "custom", path: ["iban"], message: "IBAN obbligatorio" });
      return;
    }
    const r = validateIban(d.iban);
    if (!r.ok) ctx.addIssue({ code: "custom", path: ["iban"], message: r.reason });
  });

export const requestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => payoutSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let iban = data.iban ?? null;
    if (data.use_saved_iban || !iban) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("iban")
        .eq("id", userId)
        .maybeSingle();
      iban = profile?.iban ?? null;
      if (!iban) throw new Error("Nessun IBAN salvato: inseriscilo per continuare");
      const check = validateIban(iban);
      if (!check.ok) throw new Error(`IBAN salvato non valido: ${check.reason}`);
      iban = check.iban;
    }

    // La mutazione del wallet è vietata al ruolo authenticated: passa dalla RPC
    // SECURITY DEFINER eseguita con service role (atomica: wallet + payout).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payout, error: pErr } = await supabaseAdmin.rpc("request_payout_for_user", {
      _user_id: userId,
      _points: data.points,
      _iban: iban,
    });
    if (pErr || !payout) {
      throw new Error(pErr?.message ?? "Impossibile creare la richiesta di prelievo");
    }

    // Notifica multicanale ai referenti dell'ente: c'è un prelievo da pagare.
    try {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("company_id, full_name")
        .eq("id", userId)
        .maybeSingle();
      if (prof?.company_id) {
        const { notifyUsers, companyManagerIds } = await import("@/lib/notify.server");
        const managers = await companyManagerIds(prof.company_id);
        const amount = Number(payout.amount_eur).toFixed(2);
        await notifyUsers({
          userIds: managers,
          topic: "company",
          type: "payout_requested",
          title: "Nuova richiesta di prelievo",
          body: `${prof.full_name ?? "Un membro"} ha richiesto € ${amount} (${payout.points_redeemed} punti). Puoi pagarla dalla sezione Prelievi.`,
          url: "/azienda",
          companyId: prof.company_id,
          ctaLabel: "Vai ai prelievi",
          details: [
            { label: "Richiedente", value: prof.full_name ?? "Membro" },
            { label: "Importo", value: `€ ${amount}` },
          ],
          payload: { payout_id: payout.id, ref: payout.id },
        });
      }
    } catch (e) {
      console.error("[requestPayout] notify failed", e);
    }

    return {
      id: payout.id,
      amount_eur: Number(payout.amount_eur),
      points: payout.points_redeemed,
    };
  });

export const listMyPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("payout_requests")
      .select("id, points_redeemed, amount_eur, status, created_at, iban_snapshot, admin_notes")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
  });

/**
 * Prelievi dei membri dell'ente (azienda o Comune): elenco + totali, per dare
 * al titolare visibilità sui punti convertiti in denaro dai suoi iscritti.
 */
export const listCompanyPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.company_id) throw new Error("Nessun ente associato");
    const { data: owns } = await supabase.rpc("owns_company", {
      _company_id: profile.company_id,
    });
    if (!owns) throw new Error("Accesso riservato al titolare dell'ente");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: members } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("company_id", profile.company_id);

    const ids = (members ?? []).map((m) => m.id);
    if (ids.length === 0) {
      return { items: [], totals: { pending: 0, paid_eur: 0, pending_eur: 0, points: 0 } };
    }
    const names = new Map((members ?? []).map((m) => [m.id, m.full_name ?? "—"]));

    const [{ data: payouts }, { data: cfg }] = await Promise.all([
      supabaseAdmin
        .from("payout_requests")
        .select("id, user_id, points_redeemed, amount_eur, status, created_at, iban_snapshot")
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("app_config")
        .select("eur_per_point")
        .eq("id", 1)
        .maybeSingle(),
    ]);

    const items = (payouts ?? []).map((p) => ({
      id: p.id,
      user_name: names.get(p.user_id) ?? "—",
      points_redeemed: p.points_redeemed,
      amount_eur: Number(p.amount_eur),
      status: p.status,
      created_at: p.created_at,
      iban_snapshot: p.iban_snapshot as string | null,
    }));

    const totals = items.reduce(
      (acc, p) => {
        if (p.status === "paid") acc.paid_eur += p.amount_eur;
        if (p.status === "pending" || p.status === "approved") {
          acc.pending += 1;
          acc.pending_eur += p.amount_eur;
        }
        acc.points += p.points_redeemed;
        return acc;
      },
      { pending: 0, paid_eur: 0, pending_eur: 0, points: 0 },
    );

    return {
      items,
      totals: {
        ...totals,
        paid_eur: Number(totals.paid_eur.toFixed(2)),
        pending_eur: Number(totals.pending_eur.toFixed(2)),
      },
      eur_per_point: Number(cfg?.eur_per_point ?? 0.01),
    };
  });


/**
 * STUB abbonamento B2B. Crea/aggiorna un record company_subscriptions a "trial"
 * e simula l'attivazione. Quando avremo la chiave Stripe, qui creeremo una
 * Checkout Session per il piano mensile.
 */
export const startCompanySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.company_id) throw new Error("Nessuna azienda associata");

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("company_subscriptions")
      .upsert(
        {
          company_id: profile.company_id,
          status: "trial",
          plan: "starter",
          current_period_end: trialEnd.toISOString(),
        },
        { onConflict: "company_id" },
      );
    if (error) throw new Error("Impossibile attivare il trial");

    return {
      stub: true as const,
      status: "trial",
      current_period_end: trialEnd.toISOString(),
      message:
        "Trial 14 giorni attivato (stub). Con la chiave Stripe collegata partirà il checkout reale.",
    };
  });

/**
 * Verifica un codice sconto per il piano scelto (anteprima prezzo, non consuma
 * il codice). Riservata ai titolari di un ente autenticati.
 */
export const previewDiscountCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string().trim().min(3).max(40),
        plan: z.enum(["starter", "pro", "enterprise"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { checkDiscountCode } = await import("@/lib/discounts.server");
    const res = await checkDiscountCode(data.code, data.plan);
    if (!res.ok) return { valid: false as const, reason: res.reason };
    return {
      valid: true as const,
      percent_off: res.percent_off,
      final_price_eur: res.final_price_eur,
      label: res.label,
    };
  });

/**
 * Attiva l'abbonamento dell'ente sul piano scelto. Con un codice sconto 100%
 * (partner in fase di test) l'attivazione è immediata e gratuita; senza Stripe
 * collegato e senza codice, si attiva un trial di 14 giorni.
 */
export const activateCompanySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        plan: z.enum(["starter", "pro", "enterprise"]),
        discount_code: z.string().trim().max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getPlan } = await import("@/lib/plans");

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.company_id) throw new Error("Nessun ente associato");
    const { data: owns } = await supabase.rpc("owns_company", {
      _company_id: profile.company_id,
    });
    if (!owns) throw new Error("Accesso riservato al titolare dell'ente");

    const plan = getPlan(data.plan);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let discountCode: string | null = null;
    let price = plan.priceEur;
    let status: "active" | "trial" = "trial";

    if (data.discount_code) {
      const { checkDiscountCode } = await import("@/lib/discounts.server");
      const res = await checkDiscountCode(data.discount_code, data.plan);
      if (!res.ok) throw new Error(res.reason);
      discountCode = res.code;
      price = res.final_price_eur;
      if (price === 0) status = "active";
      const { data: dc } = await supabaseAdmin
        .from("discount_codes")
        .select("redeemed_count")
        .eq("id", res.id)
        .single();
      await supabaseAdmin
        .from("discount_codes")
        .update({ redeemed_count: (dc?.redeemed_count ?? 0) + 1 })
        .eq("id", res.id);
    }

    const periodEnd = new Date();
    if (status === "active") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setDate(periodEnd.getDate() + 14);

    const { error } = await supabaseAdmin
      .from("company_subscriptions")
      .upsert(
        {
          company_id: profile.company_id,
          status,
          plan: data.plan,
          seats: plan.seats,
          monthly_price_eur: price,
          discount_code: discountCode,
          current_period_end: periodEnd.toISOString(),
        },
        { onConflict: "company_id" },
      );
    if (error) throw new Error("Impossibile attivare l'abbonamento");

    await supabaseAdmin
      .from("companies")
      .update({ plan: data.plan, employee_cap: plan.seats, subscription_status: status })
      .eq("id", profile.company_id);

    return {
      status,
      plan: data.plan,
      monthly_price_eur: price,
      discount_code: discountCode,
      current_period_end: periodEnd.toISOString(),
      message:
        status === "active"
          ? `Abbonamento ${plan.name} attivato gratuitamente con il codice ${discountCode}.`
          : `Trial 14 giorni attivato sul piano ${plan.name}.`,
    };
  });
