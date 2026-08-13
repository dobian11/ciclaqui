import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Coordinate bancarie su cui l'ente effettua il bonifico di ricarica. */
export const TOPUP_BANK = {
  beneficiary: "Cicla Qui S.r.l.",
  iban: "IT60X0542811101000000123456",
  bic: "BLOPIT22",
  bank: "Banca Popolare",
} as const;

async function requireOwner(context: {
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

/** Saldo del conto ente + ultime ricariche e movimenti. */
export const getCompanyWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const companyId = await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: wallet }, { data: topups }, { data: tx }, { data: pending }] =
      await Promise.all([
        supabaseAdmin
          .from("company_wallets")
          .select("balance_eur, lifetime_topup_eur, lifetime_paid_eur")
          .eq("company_id", companyId)
          .maybeSingle(),
        supabaseAdmin
          .from("company_topups")
          .select("id, amount_eur, method, status, reference, created_at, confirmed_at")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabaseAdmin
          .from("company_wallet_transactions")
          .select("id, delta_eur, kind, note, created_at, user_id")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(30),
        supabaseAdmin.from("profiles").select("id, full_name").eq("company_id", companyId),
      ]);

    const names = new Map((pending ?? []).map((p) => [p.id, p.full_name ?? "—"]));

    return {
      balance_eur: Number(wallet?.balance_eur ?? 0),
      lifetime_topup_eur: Number(wallet?.lifetime_topup_eur ?? 0),
      lifetime_paid_eur: Number(wallet?.lifetime_paid_eur ?? 0),
      bank: TOPUP_BANK,
      topups: (topups ?? []).map((t) => ({
        ...t,
        amount_eur: Number(t.amount_eur),
      })),
      transactions: (tx ?? []).map((t) => ({
        id: t.id,
        delta_eur: Number(t.delta_eur),
        kind: t.kind,
        note: t.note,
        created_at: t.created_at,
        user_name: t.user_id ? (names.get(t.user_id) ?? null) : null,
      })),
    };
  });

/** Crea una richiesta di ricarica (bonifico o carta). */
export const createCompanyTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        amount_eur: z.number().positive("Importo non valido").max(100000),
        method: z.enum(["bank_transfer", "card"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const companyId = await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const reference = `CQ-${Date.now().toString(36).toUpperCase()}`;
    const { data: topup, error } = await supabaseAdmin
      .from("company_topups")
      .insert({
        company_id: companyId,
        amount_eur: Number(data.amount_eur.toFixed(2)),
        method: data.method,
        status: "pending",
        reference,
        created_by: context.userId,
      })
      .select("id, amount_eur, method, status, reference, created_at")
      .single();
    if (error || !topup) throw new Error("Impossibile creare la ricarica");

    await supabaseAdmin.from("admin_notifications").insert({
      type: "company_topup",
      title: "Nuova ricarica conto ente",
      body: `Richiesta di € ${Number(topup.amount_eur).toFixed(2)} (${
        data.method === "card" ? "carta" : "bonifico"
      }) · rif. ${reference}`,
      company_id: companyId,
      payload: { topup_id: topup.id },
    });

    return {
      id: topup.id,
      amount_eur: Number(topup.amount_eur),
      reference,
      method: data.method,
      bank: TOPUP_BANK,
      card_checkout_url: null as string | null,
      message:
        data.method === "card"
          ? "Pagamento con carta non ancora attivo: la ricarica resta in attesa e viene confermata dal team Cicla Qui."
          : "Effettua il bonifico indicando la causale: appena lo riceviamo il saldo viene accreditato.",
    };
  });

/** Pagamento con un click di un prelievo di un membro, scalato dal conto ente. */
export const payMemberPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ payout_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: payout, error } = await supabaseAdmin.rpc("pay_payout_from_company", {
      _payout_id: data.payout_id,
      _company_id: companyId,
      _actor: context.userId,
    });
    if (error || !payout) throw new Error(error?.message ?? "Pagamento non riuscito");

    // La riga in-app è già creata dalla RPC: qui aggiungiamo push + email.
    try {
      const { notifyUsers } = await import("@/lib/notify.server");
      const amount = Number(payout.amount_eur).toFixed(2);
      await notifyUsers({
        userIds: [payout.user_id],
        topic: "rewards",
        type: "payout_paid",
        title: "Prelievo pagato",
        body: `Il tuo ente ha effettuato il bonifico di € ${amount} sul tuo IBAN.`,
        url: "/app/punti",
        companyId: companyId,
        skipInApp: true,
        ctaLabel: "Vedi i tuoi punti",
        details: [{ label: "Importo", value: `€ ${amount}` }],
        payload: { payout_id: payout.id, ref: payout.id },
      });
    } catch (e) {
      console.error("[payMemberPayout] notify failed", e);
    }

    return { id: payout.id, amount_eur: Number(payout.amount_eur), status: payout.status };
  });

/** Admin: elenco ricariche in attesa di conferma. */
export const adminListTopups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Accesso riservato agli amministratori");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("company_topups")
      .select("id, company_id, amount_eur, method, status, reference, created_at, confirmed_at")
      .order("created_at", { ascending: false })
      .limit(100);

    const ids = [...new Set((data ?? []).map((t) => t.company_id))];
    const { data: companies } = ids.length
      ? await supabaseAdmin.from("companies").select("id, name").in("id", ids)
      : { data: [] as { id: string; name: string }[] };
    const names = new Map((companies ?? []).map((c) => [c.id, c.name]));

    return (data ?? []).map((t) => ({
      ...t,
      amount_eur: Number(t.amount_eur),
      company_name: names.get(t.company_id) ?? "—",
    }));
  });

/** Admin: conferma una ricarica e accredita il saldo dell'ente. */
export const adminConfirmTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ topup_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Accesso riservato agli amministratori");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: topup, error } = await supabaseAdmin.rpc("confirm_company_topup", {
      _topup_id: data.topup_id,
      _actor: context.userId,
    });
    if (error || !topup) throw new Error(error?.message ?? "Conferma non riuscita");

    try {
      const { notifyUsers, companyManagerIds } = await import("@/lib/notify.server");
      const amount = Number(topup.amount_eur).toFixed(2);
      await notifyUsers({
        userIds: await companyManagerIds(topup.company_id),
        topic: "company",
        type: "topup_confirmed",
        title: "Ricarica confermata",
        body: `Abbiamo accreditato € ${amount} sul conto del tuo ente. Ora puoi pagare i prelievi dei membri.`,
        url: "/azienda",
        companyId: topup.company_id,
        ctaLabel: "Apri il conto ente",
        details: [{ label: "Importo accreditato", value: `€ ${amount}` }],
        payload: { topup_id: topup.id, ref: topup.id },
      });
    } catch (e) {
      console.error("[adminConfirmTopup] notify failed", e);
    }

    return { id: topup.id, amount_eur: Number(topup.amount_eur), status: topup.status };
  });
