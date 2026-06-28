import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const requestDataExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Raccoglie tutti i dati dell'utente
    const [profile, bikes, trips, wallet, points, redemptions, badges, prefs] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("bikes").select("*").eq("owner_id", userId),
      supabase.from("trips").select("*").eq("user_id", userId),
      supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("point_transactions").select("*").eq("user_id", userId),
      supabase.from("reward_redemptions").select("*").eq("user_id", userId),
      supabase.from("badges").select("*").eq("user_id", userId),
      supabase.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    const dump = {
      generated_at: new Date().toISOString(),
      user_id: userId,
      profile: profile.data,
      bikes: bikes.data ?? [],
      trips: trips.data ?? [],
      wallet: wallet.data,
      point_transactions: points.data ?? [],
      reward_redemptions: redemptions.data ?? [],
      badges: badges.data ?? [],
      notification_preferences: prefs.data,
    };

    await supabase.from("data_export_requests").insert({
      user_id: userId,
      status: "ready",
      ready_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    });

    return { json: dump };
  });

export const scheduleAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reason?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scheduled = new Date(Date.now() + 30 * 86400_000).toISOString();
    const { error } = await supabase
      .from("account_deletion_requests")
      .upsert({ user_id: userId, reason: data.reason ?? null, scheduled_for: scheduled, cancelled_at: null });
    if (error) throw new Error(error.message);
    return { scheduled_for: scheduled };
  });

export const cancelAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("account_deletion_requests")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
