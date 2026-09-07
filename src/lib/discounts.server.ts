import { getPlan, type PlanId } from "@/lib/plans";

export type DiscountCheck =
  | { ok: false; reason: string }
  | {
      ok: true;
      id: string;
      code: string;
      label: string | null;
      percent_off: number;
      final_price_eur: number;
    };

/**
 * Verifica un codice sconto per un piano. Non lo consuma.
 */
export async function checkDiscountCode(
  rawCode: string,
  plan: PlanId,
): Promise<DiscountCheck> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const code = rawCode.trim().toUpperCase();

  const { data } = await supabaseAdmin
    .from("discount_codes")
    .select("id, code, label, percent_off, plan, max_redemptions, redeemed_count, expires_at, active")
    .eq("code", code)
    .maybeSingle();

  if (!data) return { ok: false, reason: "Codice sconto non valido" };
  if (!data.active) return { ok: false, reason: "Codice sconto disattivato" };
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { ok: false, reason: "Codice sconto scaduto" };
  }
  if (data.max_redemptions !== null && data.redeemed_count >= data.max_redemptions) {
    return { ok: false, reason: "Codice sconto esaurito" };
  }
  if (data.plan && data.plan !== plan) {
    return { ok: false, reason: `Codice valido solo per il piano ${getPlan(data.plan).name}` };
  }

  const base = getPlan(plan).priceEur ?? 0;
  const final = Math.round(base * (1 - data.percent_off / 100) * 100) / 100;

  return {
    ok: true,
    id: data.id,
    code: data.code,
    label: data.label,
    percent_off: data.percent_off,
    final_price_eur: final,
  };
}
