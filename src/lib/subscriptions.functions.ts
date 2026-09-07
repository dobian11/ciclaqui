import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";
import { getPlan, PLANS } from "@/lib/plans";

const envSchema = z.enum(["sandbox", "live"]);
const planSchema = z.enum(["starter", "pro", "advanced"]);

/**
 * Se l'amministratore ha attivato la promo (es. 10% entro il 15.01.27), crea o
 * riusa il coupon corrispondente e ne restituisce l'id per il checkout.
 */
async function resolvePromoCoupon(stripe: any): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: promo } = await (supabaseAdmin as any)
    .from("promo_banner")
    .select("active, percent_off, ends_at")
    .eq("id", 1)
    .maybeSingle();
  if (!promo?.active) return null;
  const percent = Number(promo.percent_off ?? 0);
  if (percent <= 0) return null;
  if (new Date(promo.ends_at).getTime() <= Date.now()) return null;

  const couponId = `cicla_promo_${percent}`;
  try {
    await stripe.coupons.retrieve(couponId);
  } catch {
    await stripe.coupons.create({
      id: couponId,
      percent_off: percent,
      duration: "forever",
      name: `Promo Cicla Qui -${percent}%`,
    });
  }
  return couponId;
}

/** Verifica che l'utente sia titolare di un ente e ne restituisce l'id. */
async function ownedCompanyId(context: {
  supabase: any;
  userId: string;
}): Promise<string> {
  const { data: profile } = await context.supabase
    .from("profiles")
    .select("company_id")
    .eq("id", context.userId)
    .maybeSingle();
  if (!profile?.company_id) throw new Error("Nessun ente associato");
  const { data: owns } = await context.supabase.rpc("owns_company", {
    _company_id: profile.company_id,
  });
  if (!owns) throw new Error("Accesso riservato al titolare dell'ente");
  return profile.company_id as string;
}

/**
 * Stato abbonamento dell'ente: piano attivo, fine periodo pagato ed eventuale
 * cambio piano già programmato per l'inizio del prossimo periodo.
 */
export const getCompanySubscriptionState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ environment: envSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await ownedCompanyId(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("company_subscriptions")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (!sub) return { subscription: null, environment: data.environment };

    const s = sub as Record<string, any>;
    return {
      environment: data.environment,
      subscription: {
        plan: s.plan as string,
        status: s.status as string,
        monthly_price_eur: Number(s.monthly_price_eur ?? 0),
        seats: s.seats as number,
        discount_code: (s.discount_code ?? null) as string | null,
        current_period_end: (s.current_period_end ?? null) as string | null,
        cancel_at_period_end: Boolean(s.cancel_at_period_end),
        pending_plan: (s.pending_plan ?? null) as string | null,
        pending_plan_effective_at: (s.pending_plan_effective_at ?? null) as string | null,
        is_paid: Boolean(s.stripe_subscription_id),
      },
    };
  });

/**
 * Avvia il pagamento reale dell'abbonamento mensile: crea (o riusa) il cliente
 * e apre una sessione di checkout in modalità abbonamento.
 */
export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        plan: planSchema,
        environment: envSchema,
        returnUrl: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    const companyId = await ownedCompanyId(context as never);
    const plan = getPlan(data.plan);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, name, contact_email, stripe_customer_id, status")
      .eq("id", companyId)
      .maybeSingle();
    if (!company) throw new Error("Ente non trovato");

    const { data: existing } = await supabaseAdmin
      .from("company_subscriptions")
      .select("stripe_subscription_id, status")
      .eq("company_id", companyId)
      .maybeSingle();
    if (existing?.stripe_subscription_id) {
      return {
        error:
          "Hai già un abbonamento attivo. Per cambiare piano usa il cambio piano: diventa effettivo alla fine del mese già pagato.",
      };
    }

    try {
      const stripe = createStripeClient(data.environment as StripeEnv);

      let customerId = company.stripe_customer_id as string | null;
      if (!customerId) {
        const created = await stripe.customers.create({
          name: company.name,
          email: company.contact_email,
          metadata: { companyId },
        });
        customerId = created.id;
        await supabaseAdmin
          .from("companies")
          .update({ stripe_customer_id: customerId })
          .eq("id", companyId);
      }

      const prices = await stripe.prices.list({ lookup_keys: [plan.priceId] });
      const price = prices.data[0];
      if (!price) throw new Error("Prezzo del piano non trovato");

      // Sconto promozionale attivo dalla dashboard admin (es. -10% entro una data)
      const promoDiscount = await resolvePromoCoupon(stripe);

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        line_items: [{ price: price.id, quantity: 1 }],
        ...(promoDiscount ? { discounts: [{ coupon: promoDiscount }] } : {}),
        metadata: { companyId, plan: plan.id },
        subscription_data: { metadata: { companyId, plan: plan.id } },
        managed_payments: { enabled: true },
      } as any);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * Cambio piano con regola "il mese pagato si completa": il nuovo piano parte
 * automaticamente alla fine del periodo già fatturato, senza rimborsi né
 * addebiti parziali.
 */
export const scheduleCompanyPlanChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ plan: planSchema, environment: envSchema }).parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ effective_at: string | null; plan: string } | { error: string }> => {
      const companyId = await ownedCompanyId(context as never);
      const newPlan = getPlan(data.plan);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: sub } = await supabaseAdmin
        .from("company_subscriptions")
        .select("stripe_subscription_id, plan, current_period_end")
        .eq("company_id", companyId)
        .maybeSingle();

      if (!sub?.stripe_subscription_id) {
        return {
          error:
            "Nessun abbonamento pagato attivo: attiva prima un piano per poterlo cambiare.",
        };
      }
      if (sub.plan === newPlan.id) return { error: "È già il piano attivo." };

      try {
        const stripe = createStripeClient(data.environment as StripeEnv);
        const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);

        const prices = await stripe.prices.list({ lookup_keys: [newPlan.priceId] });
        const newPrice = prices.data[0];
        if (!newPrice) throw new Error("Prezzo del piano non trovato");

        const item = subscription.items.data[0];
        const currentPriceId =
          typeof item?.price === "string" ? item.price : (item?.price?.id ?? "");
        const periodStart =
          (item as any)?.current_period_start ?? (subscription as any).current_period_start;
        const periodEnd =
          (item as any)?.current_period_end ?? (subscription as any).current_period_end;

        const scheduleId =
          typeof subscription.schedule === "string"
            ? subscription.schedule
            : (subscription.schedule?.id ??
              (await stripe.subscriptionSchedules.create({ from_subscription: subscription.id }))
                .id);

        await stripe.subscriptionSchedules.update(scheduleId, {
          end_behavior: "release",
          phases: [
            {
              items: [{ price: currentPriceId, quantity: 1 }],
              start_date: periodStart,
              end_date: periodEnd,
            },
            {
              items: [{ price: newPrice.id, quantity: 1 }],
              metadata: { companyId, plan: newPlan.id },
            },
          ],
          proration_behavior: "none",
        } as any);

        const effectiveAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
        await supabaseAdmin
          .from("company_subscriptions")
          .update({
            pending_plan: newPlan.id,
            pending_plan_effective_at: effectiveAt,
            updated_at: new Date().toISOString(),
          })
          .eq("company_id", companyId);

        return { plan: newPlan.id, effective_at: effectiveAt };
      } catch (error) {
        return { error: getStripeErrorMessage(error) };
      }
    },
  );

/** Annulla un cambio piano programmato e resta sul piano attuale. */
export const cancelScheduledPlanChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ environment: envSchema }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const companyId = await ownedCompanyId(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("company_subscriptions")
      .select("stripe_subscription_id")
      .eq("company_id", companyId)
      .maybeSingle();
    if (!sub?.stripe_subscription_id) return { error: "Nessun abbonamento attivo" };

    try {
      const stripe = createStripeClient(data.environment as StripeEnv);
      const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
      const scheduleId =
        typeof subscription.schedule === "string"
          ? subscription.schedule
          : (subscription.schedule?.id ?? null);
      if (scheduleId) await stripe.subscriptionSchedules.release(scheduleId);

      await supabaseAdmin
        .from("company_subscriptions")
        .update({
          pending_plan: null,
          pending_plan_effective_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", companyId);
      return { ok: true };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Disdetta a fine periodo: l'ente resta attivo fino alla scadenza pagata. */
export const cancelCompanySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ environment: envSchema }).parse(d))
  .handler(
    async ({ data, context }): Promise<{ ends_at: string | null } | { error: string }> => {
      const companyId = await ownedCompanyId(context as never);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: sub } = await supabaseAdmin
        .from("company_subscriptions")
        .select("stripe_subscription_id, current_period_end")
        .eq("company_id", companyId)
        .maybeSingle();
      if (!sub?.stripe_subscription_id) return { error: "Nessun abbonamento attivo" };

      try {
        const stripe = createStripeClient(data.environment as StripeEnv);
        const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
        const item = updated.items.data[0];
        const periodEnd =
          (item as any)?.current_period_end ?? (updated as any).current_period_end;
        const endsAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
        await supabaseAdmin
          .from("company_subscriptions")
          .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
          .eq("company_id", companyId);
        return { ends_at: endsAt };
      } catch (error) {
        return { error: getStripeErrorMessage(error) };
      }
    },
  );

/** Riattiva un abbonamento disdetto prima della scadenza. */
export const resumeCompanySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ environment: envSchema }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const companyId = await ownedCompanyId(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("company_subscriptions")
      .select("stripe_subscription_id")
      .eq("company_id", companyId)
      .maybeSingle();
    if (!sub?.stripe_subscription_id) return { error: "Nessun abbonamento attivo" };
    try {
      const stripe = createStripeClient(data.environment as StripeEnv);
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: false,
      });
      await supabaseAdmin
        .from("company_subscriptions")
        .update({ cancel_at_period_end: false, updated_at: new Date().toISOString() })
        .eq("company_id", companyId);
      return { ok: true };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Portale di fatturazione: metodi di pagamento, fatture e ricevute. */
export const createBillingPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ environment: envSchema, returnUrl: z.string().url().optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    const companyId = await ownedCompanyId(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("stripe_customer_id")
      .eq("id", companyId)
      .maybeSingle();
    if (!company?.stripe_customer_id) return { error: "Nessun pagamento registrato" };
    try {
      const stripe = createStripeClient(data.environment as StripeEnv);
      const portal = await stripe.billingPortal.sessions.create({
        customer: company.stripe_customer_id,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const availablePlans = PLANS;
