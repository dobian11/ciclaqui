import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Marketplace Doctorbike: listino di servizi/prodotti che l'ente acquista
 * con il proprio conto prepagato e mette a disposizione dei dipendenti
 * come premio riscattabile a punti.
 */

export type DoctorbikeItem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  price_eur: number;
  suggested_points: number;
  image_url: string | null;
};

async function ownedCompanyId(context: { supabase: any; userId: string }): Promise<string> {
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

/** Listino Doctorbike acquistabile dagli enti. */
export const listDoctorbikeCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DoctorbikeItem[]> => {
    const { data } = await (context.supabase as any)
      .from("doctorbike_catalog")
      .select("id, title, description, category, price_eur, suggested_points, image_url")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    return ((data ?? []) as any[]).map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      category: i.category,
      price_eur: Number(i.price_eur),
      suggested_points: Number(i.suggested_points),
      image_url: i.image_url ?? null,
    }));
  });

/** L'ente acquista un servizio Doctorbike scalandolo dal conto prepagato. */
export const purchaseDoctorbikeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        item_id: z.string().uuid(),
        qty: z.number().int().min(1).max(500),
        points_cost: z.number().int().min(500).max(1_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const companyId = await ownedCompanyId(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: reward, error } = await (supabaseAdmin as any).rpc("purchase_doctorbike_item", {
      _company_id: companyId,
      _item_id: data.item_id,
      _qty: data.qty,
      _points_cost: data.points_cost,
      _actor: context.userId,
    });
    if (error || !reward) throw new Error(error?.message ?? "Acquisto non riuscito");

    return {
      ok: true as const,
      reward_id: reward.id as string,
      title: reward.title as string,
      stock: reward.stock as number | null,
      points_cost: reward.points_cost as number,
    };
  });

/** Admin Cicla Qui: tutti i premi riscattati dai dipendenti. */
export const adminListRedemptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Accesso riservato agli amministratori");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("reward_redemptions")
      .select(
        "id, code, status, points_spent, redeemed_at, used_at, expires_at, cancel_reason, reward_id, user_id",
      )
      .order("redeemed_at", { ascending: false })
      .limit(200);

    const rewardIds = [...new Set((rows ?? []).map((r) => r.reward_id))];
    const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];

    const [{ data: rewards }, { data: profiles }] = await Promise.all([
      rewardIds.length
        ? supabaseAdmin
            .from("rewards_catalog")
            .select("id, title, partner, category, cash_value_eur, company_id")
            .in("id", rewardIds)
        : Promise.resolve({ data: [] as any[] } as any),
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, full_name, company_id").in("id", userIds)
        : Promise.resolve({ data: [] as any[] } as any),
    ]);

    const companyIds = [
      ...new Set([
        ...((rewards ?? []) as any[]).map((r) => r.company_id),
        ...((profiles ?? []) as any[]).map((p) => p.company_id),
      ]),
    ].filter(Boolean);
    const { data: companies } = companyIds.length
      ? await supabaseAdmin.from("companies").select("id, name").in("id", companyIds)
      : { data: [] as { id: string; name: string }[] };

    const rewardById = new Map(((rewards ?? []) as any[]).map((r) => [r.id, r]));
    const profileById = new Map(((profiles ?? []) as any[]).map((p) => [p.id, p]));
    const companyName = new Map(((companies ?? []) as any[]).map((c) => [c.id, c.name]));

    return (rows ?? []).map((r) => {
      const rw = rewardById.get(r.reward_id);
      const pr = profileById.get(r.user_id);
      const cid = rw?.company_id ?? pr?.company_id ?? null;
      return {
        id: r.id,
        code: r.code,
        status: r.status,
        points_spent: r.points_spent,
        redeemed_at: r.redeemed_at,
        used_at: r.used_at,
        expires_at: r.expires_at,
        cancel_reason: r.cancel_reason,
        user_name: pr?.full_name ?? "Dipendente",
        company_name: cid ? (companyName.get(cid) ?? "—") : "—",
        reward_title: rw?.title ?? "Premio",
        partner: rw?.partner ?? null,
        category: rw?.category ?? "voucher",
        value_eur: rw?.cash_value_eur != null ? Number(rw.cash_value_eur) : null,
      };
    });
  });
