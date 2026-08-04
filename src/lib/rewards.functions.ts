import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Gestione del catalogo premi riservato ai manager di un ente (azienda/comune).
 * Ogni premio creato qui ha scope "company" ed è visibile solo ai membri dell'ente.
 */

async function assertManagerCompany(
  supabase: { from: (t: string) => any; rpc: (fn: string, args: Record<string, unknown>) => any },
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
    if (error || !redemption) throw new Error("Impossibile riscattare il premio");
    return { code: redemption.code };
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
  category: z.enum(["voucher", "cash", "donation", "experience", "merch"]),
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
