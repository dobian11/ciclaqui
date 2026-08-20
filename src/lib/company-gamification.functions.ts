import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertManagerCompany, monthRange } from "@/lib/company-guard";
import { z } from "zod";

/** Coppe & maratone dell'ente ------------------------------------------------ */

export const listCompanyChallenges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const companyId = await assertManagerCompany(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: challenges } = await supabaseAdmin
      .from("challenges")
      .select("*")
      .eq("company_id", companyId)
      .order("ends_at", { ascending: false });

    const ids = (challenges ?? []).map((c: any) => c.id);
    const { data: parts } = ids.length
      ? await supabaseAdmin
          .from("user_challenges")
          .select("challenge_id, progress, completed_at")
          .in("challenge_id", ids)
      : { data: [] as any[] };

    return (challenges ?? []).map((c: any) => {
      const rows = (parts ?? []).filter((p: any) => p.challenge_id === c.id);
      return {
        ...c,
        participants: rows.length,
        completed: rows.filter((r: any) => r.completed_at).length,
        team_progress: rows.reduce((s: number, r: any) => s + Number(r.progress ?? 0), 0),
      };
    });
  });

const challengeInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  type: z.enum(["km_bike", "km_foot", "streak_days", "trip_count", "co2_saved"]),
  period: z.enum(["weekly", "monthly", "one_off"]),
  is_team: z.boolean().default(false),
  trophy_label: z.string().trim().max(80).optional().nullable(),
  goal: z.number().min(1).max(1_000_000),
  reward_points: z.number().int().min(0).max(1_000_000),
  icon: z.string().trim().max(8).optional().nullable(),
  starts_at: z.string(),
  ends_at: z.string(),
  is_active: z.boolean().default(true),
});

export const upsertCompanyChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => challengeInput.parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await assertManagerCompany(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      company_id: companyId,
      title: data.title,
      description: data.description ?? null,
      type: data.type,
      period: data.period,
      is_team: data.is_team,
      trophy_label: data.trophy_label ?? null,
      goal: data.goal,
      reward_points: data.reward_points,
      icon: data.icon ?? null,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
      is_active: data.is_active,
      created_by: context.userId,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("challenges")
        .update(payload)
        .eq("id", data.id)
        .eq("company_id", companyId);
      if (error) throw new Error("Aggiornamento coppa fallito");
      return { ok: true as const, id: data.id };
    }

    const { data: row, error } = await supabaseAdmin
      .from("challenges")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error("Creazione coppa fallita");
    return { ok: true as const, id: row.id };
  });

export const deleteCompanyChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await assertManagerCompany(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_challenges").delete().eq("challenge_id", data.id);
    const { error } = await supabaseAdmin
      .from("challenges")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error("Eliminazione fallita");
    return { ok: true as const };
  });

/** Badge & dipendente del mese ----------------------------------------------- */

/** Classifica del mese (km green) tra i membri dell'ente: proposta automatica. */
export const getMonthlyTopMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const companyId = await assertManagerCompany(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { start, end } = monthRange(data.month);

    const { data: members } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("company_id", companyId);
    const ids = (members ?? []).map((m: any) => m.id);
    if (!ids.length) return { month: start.slice(0, 7), rows: [] as any[] };

    const { data: trips } = await supabaseAdmin
      .from("trips")
      .select("user_id, mode, distance_km, co2_saved_kg, points_earned")
      .in("user_id", ids)
      .gte("started_at", start)
      .lt("started_at", end);

    const agg = new Map<string, { km_bike: number; km_foot: number; co2: number; points: number; trips: number }>();
    for (const t of trips ?? []) {
      const cur = agg.get(t.user_id) ?? { km_bike: 0, km_foot: 0, co2: 0, points: 0, trips: 0 };
      if (t.mode === "bike") cur.km_bike += Number(t.distance_km ?? 0);
      if (t.mode === "foot") cur.km_foot += Number(t.distance_km ?? 0);
      cur.co2 += Number(t.co2_saved_kg ?? 0);
      cur.points += Number(t.points_earned ?? 0);
      cur.trips += 1;
      agg.set(t.user_id, cur);
    }

    const rows = (members ?? [])
      .map((m: any) => {
        const a = agg.get(m.id) ?? { km_bike: 0, km_foot: 0, co2: 0, points: 0, trips: 0 };
        return {
          user_id: m.id,
          full_name: m.full_name ?? "Utente",
          km_bike: Math.round(a.km_bike * 10) / 10,
          km_foot: Math.round(a.km_foot * 10) / 10,
          co2_saved_kg: Math.round(a.co2 * 100) / 100,
          points: a.points,
          trips: a.trips,
          green_km: Math.round((a.km_bike + a.km_foot) * 10) / 10,
        };
      })
      .sort((a, b) => b.km_bike - a.km_bike || b.green_km - a.green_km)
      .slice(0, 10);

    return { month: start.slice(0, 7), rows };
  });

/** Badge già assegnati dall'ente. */
export const listCompanyBadges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const companyId = await assertManagerCompany(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("badges")
      .select("id, user_id, code, title, description, icon, earned_at")
      .eq("company_id", companyId)
      .order("earned_at", { ascending: false })
      .limit(100);

    const ids = Array.from(new Set((data ?? []).map((b: any) => b.user_id)));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as any[] };
    const names = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));

    return (data ?? []).map((b: any) => ({ ...b, full_name: names.get(b.user_id) ?? "Utente" }));
  });

/** Assegna un badge (es. dipendente del mese) confermato dal manager. */
export const awardCompanyBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        code: z.string().trim().min(2).max(60),
        title: z.string().trim().min(2).max(120),
        description: z.string().trim().max(300).optional().nullable(),
        icon: z.string().trim().max(8).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const companyId = await assertManagerCompany(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member } = await supabaseAdmin
      .from("profiles")
      .select("id, company_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (!member || member.company_id !== companyId) throw new Error("Utente non appartiene al tuo ente");

    const { error } = await supabaseAdmin.from("badges").insert({
      user_id: data.userId,
      code: data.code,
      title: data.title,
      description: data.description ?? null,
      icon: data.icon ?? "🏆",
      company_id: companyId,
      awarded_by: context.userId,
    });
    if (error) throw new Error("Assegnazione badge fallita");

    await supabaseAdmin.from("user_notifications").insert({
      user_id: data.userId,
      type: "rewards",
      title: `Hai ricevuto un badge: ${data.title}`,
      body: data.description ?? "Complimenti dal tuo ente!",
      company_id: companyId,
      payload: { badge_code: data.code },
    });

    return { ok: true as const };
  });

export const revokeCompanyBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await assertManagerCompany(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("badges")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error("Rimozione badge fallita");
    return { ok: true as const };
  });

/** Podio: premi 1°/2°/3° classificato ---------------------------------------- */

async function assertChallengeOfCompany(supabaseAdmin: any, challengeId: string, companyId: string) {
  const { data } = await supabaseAdmin
    .from("challenges")
    .select("id, company_id, title, ends_at")
    .eq("id", challengeId)
    .maybeSingle();
  if (!data || data.company_id !== companyId) throw new Error("Coppa non trovata per il tuo ente");
  return data;
}

/** Premi del podio + classifica corrente di una coppa. */
export const getChallengePodium = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ challengeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await assertManagerCompany(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertChallengeOfCompany(supabaseAdmin, data.challengeId, companyId);

    const { data: prizes } = await supabaseAdmin
      .from("challenge_prizes")
      .select("id, rank_position, points, reward_id, label, awarded_user_id, awarded_at, awarded_code")
      .eq("challenge_id", data.challengeId)
      .order("rank_position");

    const { data: rows } = await supabaseAdmin
      .from("user_challenges")
      .select("user_id, progress, completed_at")
      .eq("challenge_id", data.challengeId)
      .order("progress", { ascending: false })
      .limit(10);

    const ids = Array.from(
      new Set([
        ...(rows ?? []).map((r: any) => r.user_id),
        ...(prizes ?? []).map((p: any) => p.awarded_user_id).filter(Boolean),
      ]),
    );
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as any[] };
    const names = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));

    const { data: rewards } = await supabaseAdmin
      .from("rewards_catalog")
      .select("id, title, category")
      .eq("company_id", companyId)
      .eq("active", true);

    return {
      prizes: (prizes ?? []).map((p: any) => ({
        ...p,
        awarded_name: p.awarded_user_id ? names.get(p.awarded_user_id) ?? "Utente" : null,
      })),
      standings: (rows ?? []).map((r: any, i: number) => ({
        rank: i + 1,
        user_id: r.user_id,
        full_name: names.get(r.user_id) ?? "Utente",
        progress: Number(r.progress ?? 0),
        completed: !!r.completed_at,
      })),
      rewards: rewards ?? [],
    };
  });

const prizeInput = z.object({
  challengeId: z.string().uuid(),
  prizes: z
    .array(
      z.object({
        position: z.number().int().min(1).max(3),
        points: z.number().int().min(0).max(1_000_000),
        reward_id: z.string().uuid().nullable().optional(),
        label: z.string().trim().max(160).nullable().optional(),
      }),
    )
    .max(3),
});

/** Salva/aggiorna i premi del podio (posizioni già assegnate non si toccano). */
export const saveChallengePodium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => prizeInput.parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await assertManagerCompany(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertChallengeOfCompany(supabaseAdmin, data.challengeId, companyId);

    const { data: existing } = await supabaseAdmin
      .from("challenge_prizes")
      .select("id, rank_position, awarded_at")
      .eq("challenge_id", data.challengeId);
    const locked = new Set(
      (existing ?? []).filter((p: any) => p.awarded_at).map((p: any) => p.rank_position),
    );

    // se un premio del catalogo è indicato, deve appartenere all'ente
    const rewardIds = data.prizes.map((p) => p.reward_id).filter(Boolean) as string[];
    if (rewardIds.length) {
      const { data: ok } = await supabaseAdmin
        .from("rewards_catalog")
        .select("id")
        .in("id", rewardIds)
        .eq("company_id", companyId);
      const allowed = new Set((ok ?? []).map((r: any) => r.id));
      for (const id of rewardIds) {
        if (!allowed.has(id)) throw new Error("Premio non valido per il tuo ente");
      }
    }

    for (const p of data.prizes) {
      if (locked.has(p.position)) continue;
      const row = {
        challenge_id: data.challengeId,
        rank_position: p.position,
        points: p.points,
        reward_id: p.reward_id ?? null,
        label: p.label ?? null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabaseAdmin
        .from("challenge_prizes")
        .upsert(row, { onConflict: "challenge_id,rank_position" });
      if (error) throw new Error("Salvataggio premi podio fallito");
    }

    // posizioni rimosse dal manager
    const keep = new Set(data.prizes.map((p) => p.position));
    const toDelete = (existing ?? [])
      .filter((p: any) => !p.awarded_at && !keep.has(p.rank_position))
      .map((p: any) => p.id);
    if (toDelete.length) {
      await supabaseAdmin.from("challenge_prizes").delete().in("id", toDelete);
    }

    return { ok: true as const };
  });

/** Assegna i premi ai primi 3 in classifica (idempotente). */
export const awardChallengePodium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ challengeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await assertManagerCompany(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertChallengeOfCompany(supabaseAdmin, data.challengeId, companyId);

    const { data: awarded, error } = await supabaseAdmin.rpc("award_challenge_podium", {
      _challenge_id: data.challengeId,
    } as any);
    if (error) throw new Error(error.message || "Assegnazione podio fallita");

    return { ok: true as const, awarded: (awarded ?? []) as any[] };
  });
