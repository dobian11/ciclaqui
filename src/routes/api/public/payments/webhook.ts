import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import { PLANS, UNLIMITED_SEATS } from "@/lib/plans";

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    );
  }
  return _supabase;
}

function planFromPrice(price: any): (typeof PLANS)[number] | null {
  const key = price?.lookup_key ?? price?.metadata?.lovable_external_id ?? null;
  return PLANS.find((p) => p.priceId === key) ?? null;
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

const ACTIVE = new Set(["active", "trialing", "past_due"]);

async function syncSubscription(subscription: any, env: StripeEnv) {
  const companyId = subscription.metadata?.companyId as string | undefined;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  const supabase = getSupabase();
  let targetCompanyId = companyId ?? null;
  if (!targetCompanyId && customerId) {
    const { data } = await supabase
      .from("companies")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    targetCompanyId = (data?.id as string | undefined) ?? null;
  }
  if (!targetCompanyId) {
    console.error("[payments webhook] nessun ente collegato", subscription.id);
    return;
  }

  const item = subscription.items?.data?.[0];
  const plan = planFromPrice(item?.price);
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const status = subscription.status as string;

  const dbStatus =
    status === "trialing"
      ? "trial"
      : status === "active"
        ? "active"
        : status === "past_due" || status === "unpaid"
          ? "past_due"
          : status === "canceled" || status === "incomplete_expired"
            ? "canceled"
            : "inactive";

  const row: Record<string, unknown> = {
    company_id: targetCompanyId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId ?? null,
    status: dbStatus,
    current_period_start: isoFromUnix(periodStart),
    current_period_end: isoFromUnix(periodEnd),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    environment: env,
    updated_at: new Date().toISOString(),
  };
  if (plan) {
    row["plan"] = plan.id;
    row["seats"] = plan.seats;
    row["monthly_price_eur"] = plan.priceEur;
  }

  await supabase.from("company_subscriptions").upsert(row, { onConflict: "company_id" });

  // Il piano effettivamente in corso azzera l'eventuale cambio programmato e
  // aggiorna il numero di posti dell'ente.
  if (plan) {
    const { data: current } = await supabase
      .from("company_subscriptions")
      .select("pending_plan")
      .eq("company_id", targetCompanyId)
      .maybeSingle();
    if (current?.["pending_plan"] === plan.id) {
      await supabase
        .from("company_subscriptions")
        .update({ pending_plan: null, pending_plan_effective_at: null })
        .eq("company_id", targetCompanyId);
    }

    await supabase
      .from("companies")
      .update({
        subscription_status: dbStatus,
        plan: plan.id,
        employee_cap: plan.seats >= UNLIMITED_SEATS ? UNLIMITED_SEATS : plan.seats,
        ...(customerId ? { stripe_customer_id: customerId } : {}),
      })
      .eq("id", targetCompanyId);
  } else {
    await supabase
      .from("companies")
      .update({ subscription_status: dbStatus })
      .eq("id", targetCompanyId);
  }

  if (!ACTIVE.has(status)) {
    await supabase
      .from("company_subscriptions")
      .update({ status: dbStatus })
      .eq("company_id", targetCompanyId);
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object, env);
      break;
    default:
      console.log("[payments webhook] evento non gestito:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
