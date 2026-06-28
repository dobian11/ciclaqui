import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
const payoutSchema = z.object({
  points: z.number().int().min(50, "Minimo 50 punti per prelevare (0,50 €)"),
  iban: z
    .string()
    .trim()
    .min(15, "IBAN troppo corto")
    .max(34, "IBAN troppo lungo")
    .regex(/^[A-Z]{2}[0-9A-Z]+$/i, "IBAN non valido"),
});

export const requestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => payoutSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: wallet, error: wErr } = await supabase
      .from("wallets")
      .select("points_balance, eur_balance")
      .eq("user_id", userId)
      .maybeSingle();
    if (wErr || !wallet) throw new Error("Wallet non trovato");

    if (wallet.points_balance < data.points) {
      throw new Error(`Saldo insufficiente: hai ${wallet.points_balance} punti`);
    }

    const amountEur = Number((data.points * 0.01).toFixed(2));
    const iban = data.iban.toUpperCase().replace(/\s+/g, "");

    // Salva IBAN sul profilo per riuso futuro
    await supabase.from("profiles").update({ iban }).eq("id", userId);

    // Scala punti dal wallet (lifetime restano per storico)
    const newPoints = wallet.points_balance - data.points;
    const newEur = Number((Number(wallet.eur_balance) - amountEur).toFixed(2));
    const { error: updErr } = await supabase
      .from("wallets")
      .update({ points_balance: newPoints, eur_balance: Math.max(0, newEur) })
      .eq("user_id", userId);
    if (updErr) throw new Error("Aggiornamento wallet fallito");

    // Crea la richiesta di prelievo
    const { data: payout, error: pErr } = await supabase
      .from("payout_requests")
      .insert({
        user_id: userId,
        points_redeemed: data.points,
        amount_eur: amountEur,
        status: "pending",
        iban_snapshot: iban,
      })
      .select()
      .single();
    if (pErr || !payout) {
      // rollback wallet
      await supabase
        .from("wallets")
        .update({
          points_balance: wallet.points_balance,
          eur_balance: wallet.eur_balance,
        })
        .eq("user_id", userId);
      throw new Error("Impossibile creare la richiesta di prelievo");
    }

    return { id: payout.id, amount_eur: amountEur, points: data.points };
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
          plan: "monthly",
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
