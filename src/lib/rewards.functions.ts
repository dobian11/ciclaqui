import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { REWARD_CATEGORY_VALUES } from "@/lib/reward-categories";

/**
 * Gestione del catalogo premi riservato ai manager di un ente (azienda/comune).
 * Ogni premio creato qui ha scope "company" ed è visibile solo ai membri dell'ente.
 */

async function assertManagerCompany(
  supabase: any,
  userId: string,
): Promise<string> {
  const { data: roles } = await (supabase as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isManager = (roles ?? []).some((r: { role: string }) => r.role === "company_manager");
  if (!isManager) throw new Error("Riservato ai manager dell'ente");

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.company_id) throw new Error("Nessun ente associato al tuo profilo");
  const { data: ownsCompany } = await (supabase as any).rpc("owns_company", {
    _company_id: profile.company_id,
  });
  if (!ownsCompany) throw new Error("Accesso riservato al titolare dell'ente");
  return profile.company_id as string;
}

export const redeemReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ rewardId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: redemption, error } = await supabaseAdmin.rpc("redeem_reward_for_user", {
      _user_id: context.userId,
      _reward_id: data.rewardId,
    });
    if (error || !redemption) {
      // Il messaggio della funzione DB è già in italiano e leggibile
      // (punti insufficienti, premio esaurito, già riscattato, IBAN mancante…).
      throw new Error(error?.message || "Impossibile riscattare il premio");
    }

    let isCash = false;
    try {
      const { notifyUsers, companyManagerIds } = await import("@/lib/notify.server");
      const { data: reward } = await supabaseAdmin
        .from("rewards_catalog")
        .select("title, points_cost, category, cash_value_eur, company_id")
        .eq("id", data.rewardId)
        .maybeSingle();
      isCash = reward?.category === "cash" && Number(reward?.cash_value_eur ?? 0) > 0;

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, phone, company_id, iban")
        .eq("id", context.userId)
        .maybeSingle();

      await notifyUsers({
        userIds: [context.userId],
        topic: "rewards",
        type: "reward_redeemed",
        title: "Premio riscattato",
        body: isCash
          ? `Hai richiesto "${reward?.title ?? "il premio"}" in denaro. Il tuo ente effettuerà il bonifico sull'IBAN indicato nel profilo.`
          : `Hai riscattato "${reward?.title ?? "il tuo premio"}". Conserva il codice per usarlo.`,
        url: "/app/punti?tab=rewards",
        code: redemption.code,
        ctaLabel: "Vedi i miei premi",
        details: reward?.points_cost
          ? [{ label: "Punti spesi", value: String(reward.points_cost) }]
          : [],
        payload: { reward_id: data.rewardId, ref: redemption.code },
      });

      // Email + notifica all'ente con il riepilogo del dipendente
      const companyId = reward?.company_id ?? profile?.company_id ?? null;
      if (companyId) {
        const managers = await companyManagerIds(companyId);
        if (managers.length) {
          await notifyUsers({
            userIds: managers,
            topic: "rewards",
            type: "reward_redeemed_company",
            title: "Premio riscattato da un dipendente",
            body: `${profile?.full_name ?? "Un dipendente"} ha riscattato "${reward?.title ?? "un premio"}".${
              isCash ? " È stata creata una richiesta di pagamento da saldare dal Conto Ente." : ""
            }`,
            url: isCash ? "/azienda?section=payouts" : "/azienda?section=rewards",
            companyId,
            code: redemption.code,
            ctaLabel: isCash ? "Vai ai pagamenti" : "Apri la dashboard ente",
            details: [
              { label: "Dipendente", value: profile?.full_name ?? "—" },
              ...(profile?.phone ? [{ label: "Telefono", value: profile.phone }] : []),
              { label: "Premio", value: reward?.title ?? "—" },
              { label: "Punti spesi", value: String(reward?.points_cost ?? 0) },
              ...(isCash
                ? [
                    { label: "Valore", value: `€ ${Number(reward?.cash_value_eur ?? 0).toFixed(2)}` },
                    { label: "IBAN", value: profile?.iban ?? "—" },
                  ]
                : []),
              { label: "Codice", value: redemption.code },
            ],
            payload: { reward_id: data.rewardId, ref: redemption.code, user_id: context.userId },
          });
        }
      }
    } catch (e) {
      console.error("[redeemReward] notify failed", e);
    }

    return { code: redemption.code, cash: isCash };
  });


export const listCompanyRewards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const companyId = await assertManagerCompany(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("rewards_catalog")
      .select(
        "id, title, description, partner, category, points_cost, cash_value_eur, stock, terms, active, created_at",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

const rewardInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  partner: z.string().trim().max(120).optional().nullable(),
  category: z.enum(REWARD_CATEGORY_VALUES),
  points_cost: z.number().int().min(1).max(1_000_000),
  cash_value_eur: z.number().min(0).max(100_000).optional().nullable(),
  stock: z.number().int().min(0).max(1_000_000).optional().nullable(),
  terms: z.string().trim().max(1000).optional().nullable(),
  active: z.boolean().default(true),
});

export const upsertCompanyReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rewardInput.parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await assertManagerCompany(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      title: data.title,
      description: data.description ?? null,
      partner: data.partner ?? null,
      category: data.category,
      points_cost: data.points_cost,
      cash_value_eur: data.cash_value_eur ?? null,
      stock: data.stock ?? null,
      terms: data.terms ?? null,
      active: data.active,
      scope: "company",
      company_id: companyId,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("rewards_catalog")
        .update(payload)
        .eq("id", data.id)
        .eq("company_id", companyId);
      if (error) throw new Error("Aggiornamento premio fallito");
      return { ok: true as const, id: data.id };
    }

    const { data: row, error } = await supabaseAdmin
      .from("rewards_catalog")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error("Creazione premio fallita");
    return { ok: true as const, id: row.id };
  });

/** Riscatti dei premi dell'ente, con nome del dipendente. */
export const listCompanyRedemptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const companyId = await assertManagerCompany(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rewards } = await supabaseAdmin
      .from("rewards_catalog")
      .select("id, title, category, points_cost, cash_value_eur")
      .eq("company_id", companyId);
    const byId = new Map((rewards ?? []).map((r) => [r.id, r]));
    if (!byId.size) return [];

    const { data: rows } = await supabaseAdmin
      .from("reward_redemptions")
      .select("id, code, status, points_spent, redeemed_at, used_at, reward_id, user_id")
      .in("reward_id", [...byId.keys()])
      .order("redeemed_at", { ascending: false })
      .limit(100);

    const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    return (rows ?? []).map((r) => {
      const rw = byId.get(r.reward_id);
      return {
        id: r.id,
        code: r.code,
        status: r.status,
        points_spent: r.points_spent,
        redeemed_at: r.redeemed_at,
        used_at: r.used_at,
        user_name: names.get(r.user_id) ?? "Dipendente",
        reward_title: rw?.title ?? "Premio",
        category: rw?.category ?? "voucher",
        cash_value_eur: rw?.cash_value_eur ?? null,
      };
    });
  });

/** L'ente conferma (o annulla) un riscatto: il dipendente riceve una notifica push. */
export const confirmCompanyRedemption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), action: z.enum(["confirm", "cancel"]).default("confirm") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const companyId = await assertManagerCompany(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: red } = await supabaseAdmin
      .from("reward_redemptions")
      .select("id, code, status, points_spent, user_id, reward_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!red) throw new Error("Riscatto non trovato");

    const { data: reward } = await supabaseAdmin
      .from("rewards_catalog")
      .select("id, title, company_id")
      .eq("id", red.reward_id)
      .maybeSingle();
    if (!reward || reward.company_id !== companyId) throw new Error("Riscatto non appartiene al tuo ente");

    const confirming = data.action === "confirm";
    const { error } = await supabaseAdmin
      .from("reward_redemptions")
      .update({
        status: confirming ? "confirmed" : "cancelled",
        used_at: confirming ? new Date().toISOString() : null,
      })
      .eq("id", red.id);
    if (error) throw new Error("Aggiornamento riscatto fallito");

    try {
      const { notifyUsers } = await import("@/lib/notify.server");
      await notifyUsers({
        userIds: [red.user_id],
        topic: "rewards",
        type: confirming ? "reward_confirmed" : "reward_cancelled",
        title: confirming ? "Premio confermato" : "Riscatto annullato",
        body: confirming
          ? `Il tuo ente ha confermato "${reward.title}". Mostra il codice ${red.code} per ritirarlo.`
          : `Il riscatto di "${reward.title}" è stato annullato dal tuo ente. Contattalo per maggiori informazioni.`,
        url: "/app/punti?tab=rewards",
        companyId,
        code: confirming ? red.code : undefined,
        ctaLabel: "Vedi i miei premi",
        details: [
          { label: "Premio", value: reward.title },
          { label: "Punti spesi", value: String(red.points_spent) },
        ],
        payload: { redemption_id: red.id, reward_id: reward.id, ref: red.code },
      });
    } catch (e) {
      console.error("[confirmCompanyRedemption] notify failed", e);
    }

    return { ok: true as const, status: confirming ? "confirmed" : "cancelled" };
  });

export const deleteCompanyReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await assertManagerCompany(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("rewards_catalog")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error("Eliminazione fallita");
    return { ok: true as const };
  });
