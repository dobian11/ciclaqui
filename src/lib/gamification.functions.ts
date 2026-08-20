import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Sfide attive (globali + dell'ente dell'utente) con progress dell'utente */
export const listActiveChallenges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();

    const nowIso = new Date().toISOString();
    let q = supabaseAdmin
      .from("challenges")
      .select("*")
      .eq("is_active", true)
      .lte("starts_at", nowIso)
      .gte("ends_at", nowIso);

    if (prof?.company_id) {
      q = q.or(`company_id.is.null,company_id.eq.${prof.company_id}`);
    } else {
      q = q.is("company_id", null);
    }

    const { data: challenges } = await q.order("ends_at", { ascending: true });

    const ids = (challenges ?? []).map((c) => c.id);
    const { data: progress } = ids.length
      ? await supabaseAdmin
          .from("user_challenges")
          .select("challenge_id, progress, completed_at")
          .eq("user_id", userId)
          .in("challenge_id", ids)
      : { data: [] as any[] };

    const teamIds = (challenges ?? []).filter((c: any) => c.is_team).map((c: any) => c.id);
    const { data: teamRows } = teamIds.length
      ? await supabaseAdmin
          .from("user_challenges")
          .select("challenge_id, progress")
          .in("challenge_id", teamIds)
      : { data: [] as any[] };

    const teamTotals = new Map<string, { total: number; participants: number }>();
    for (const r of teamRows ?? []) {
      const cur = teamTotals.get(r.challenge_id) ?? { total: 0, participants: 0 };
      cur.total += Number(r.progress ?? 0);
      cur.participants += 1;
      teamTotals.set(r.challenge_id, cur);
    }

    const { data: prizeRows } = ids.length
      ? await supabaseAdmin
          .from("challenge_prizes")
          .select("challenge_id, rank_position, points, label, reward_id, awarded_user_id")
          .in("challenge_id", ids)
          .order("rank_position")
      : { data: [] as any[] };

    const rewardIds = Array.from(
      new Set((prizeRows ?? []).map((p: any) => p.reward_id).filter(Boolean)),
    );
    const { data: rewardRows } = rewardIds.length
      ? await supabaseAdmin
          .from("rewards_catalog")
          .select("id, title, category")
          .in("id", rewardIds as string[])
      : { data: [] as any[] };
    const rewardMap = new Map((rewardRows ?? []).map((r: any) => [r.id, r]));

    const map = new Map((progress ?? []).map((p: any) => [p.challenge_id, p]));
    return (challenges ?? []).map((c: any) => ({
      ...c,
      progress: Number(map.get(c.id)?.progress ?? 0),
      completed_at: map.get(c.id)?.completed_at ?? null,
      team_progress: teamTotals.get(c.id)?.total ?? 0,
      team_participants: teamTotals.get(c.id)?.participants ?? 0,
      prizes: (prizeRows ?? [])
        .filter((p: any) => p.challenge_id === c.id)
        .map((p: any) => ({
          position: p.rank_position,
          points: p.points,
          label: p.label,
          reward_title: p.reward_id ? rewardMap.get(p.reward_id)?.title ?? null : null,
          reward_category: p.reward_id ? rewardMap.get(p.reward_id)?.category ?? null : null,
          won_by_me: p.awarded_user_id === userId,
        })),
    }));
  });

export const getMyStreak = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("streaks")
      .select("current_days, best_days, multiplier, last_active_date")
      .eq("user_id", userId)
      .maybeSingle();
    return (
      data ?? { current_days: 0, best_days: 0, multiplier: 1, last_active_date: null }
    );
  });

export const getMyBadges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("badges")
      .select("code, title, description, icon, earned_at")
      .eq("user_id", userId)
      .order("earned_at", { ascending: false });
    return data ?? [];
  });

export const getCompanyLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (!prof?.company_id) return [] as any[];
    const { data } = await supabaseAdmin.rpc("company_leaderboard", {
      _company_id: prof.company_id,
    } as any);
    return (data ?? []) as Array<{
      user_id: string;
      full_name: string | null;
      lifetime_points: number;
      lifetime_km: number;
      current_streak: number;
    }>;
  });
