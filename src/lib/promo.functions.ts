import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PromoBanner = {
  active: boolean;
  title: string;
  message: string;
  percent_off: number;
  ends_at: string;
};

/** Vero se la promo è attiva e non ancora scaduta. */
export function isPromoLive(promo: PromoBanner | null | undefined): boolean {
  if (!promo?.active) return false;
  return new Date(promo.ends_at).getTime() > Date.now();
}

/** Banner promozionale (lettura pubblica). */
export const getPromoBanner = createServerFn({ method: "GET" }).handler(
  async (): Promise<PromoBanner | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("promo_banner")
      .select("active, title, message, percent_off, ends_at")
      .eq("id", 1)
      .maybeSingle();
    return (data as PromoBanner | null) ?? null;
  },
);

/** Modifica del banner: riservata agli amministratori. */
export const adminUpdatePromoBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        active: z.boolean(),
        title: z.string().min(3).max(120),
        message: z.string().min(3).max(300),
        percent_off: z.number().int().min(0).max(100),
        ends_at: z.string().min(4),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<PromoBanner> => {
    const { data: isAdmin } = await (context as any).supabase.rpc("has_role", {
      _user_id: (context as any).userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Accesso riservato agli amministratori");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("promo_banner")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", 1)
      .select("active, title, message, percent_off, ends_at")
      .single();
    if (error) throw new Error(error.message);
    return row as PromoBanner;
  });
