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
 * Richiesta di prelievo punti → euro. Conversione 10 pt = 0,10 €.
 * - Valida saldo
 * - Atomica: scala punti dal wallet e crea payout_request "pending"
 * - Anti-frode base: minimo 50 punti, IBAN obbligatorio
 */
const payoutSchema = z
  .object({
    points: z.number().int().min(50, "Minimo 50 punti per prelevare (0,50 €)"),
    iban: z.string().trim().min(15, "IBAN troppo corto").max(42, "IBAN troppo lungo"),
  })
  .transform((d) => ({ ...d, iban: d.iban.replace(/\s+/g, "").toUpperCase() }))
  .superRefine((d, ctx) => {
    const r = validateIban(d.iban);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", path: ["iban"], message: r.reason });
    }
  });



export const requestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => payoutSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: wallet, error: wErr } = await supabase
      .from("wallets")
      .select("points_balance")
      .eq("user_id", userId)
      .maybeSingle();
    if (wErr || !wallet) throw new Error("Wallet non trovato");

    if (wallet.points_balance < data.points) {
      throw new Error(`Saldo insufficiente: hai ${wallet.points_balance} punti`);
    }

    // La mutazione del wallet è vietata al ruolo authenticated: passa dalla RPC
    // SECURITY DEFINER eseguita con service role (atomica: wallet + payout).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payout, error: pErr } = await supabaseAdmin.rpc("request_payout_for_user", {
      _user_id: userId,
      _points: data.points,
      _iban: data.iban,
    });
    if (pErr || !payout) {
      throw new Error(pErr?.message ?? "Impossibile creare la richiesta di prelievo");
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
      .select("id, points_redeemed, amount_eur, status, created_at, iban_snapshot")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
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
      await supabaseAdmin
        .from("discount_codes")
        .update({ redeemed_count: (await supabaseAdmin
          .from("discount_codes")
          .select("redeemed_count")
          .eq("id", res.id)
          .single()).data!.redeemed_count + 1 })
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
