import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Ritorna l'elenco dipendenti dell'azienda del manager corrente con
 * km totali, punti lifetime e punti correnti. Usa supabaseAdmin previa
 * verifica del ruolo company_manager.
 */
export const listMyEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // verifica ruolo
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isManager = roles?.some((r) => r.role === "company_manager");
    if (!isManager) throw new Error("Solo i company manager possono vedere i dipendenti");

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.company_id) throw new Error("Nessuna azienda associata");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: employees } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, created_at")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });

    if (!employees || employees.length === 0) return [];

    const ids = employees.map((e) => e.id);
    const [{ data: wallets }, { data: trips }] = await Promise.all([
      supabaseAdmin
        .from("wallets")
        .select("user_id, points_balance, lifetime_points, lifetime_km")
        .in("user_id", ids),
      supabaseAdmin
        .from("trips")
        .select("user_id, distance_km, mode")
        .in("user_id", ids),
    ]);

    const tripsByUser = new Map<string, { km: number; trips: number }>();
    (trips ?? []).forEach((t) => {
      const cur = tripsByUser.get(t.user_id) ?? { km: 0, trips: 0 };
      cur.km += Number(t.distance_km ?? 0);
      cur.trips += 1;
      tripsByUser.set(t.user_id, cur);
    });

    const walletByUser = new Map(wallets?.map((w) => [w.user_id, w]) ?? []);

    return employees.map((e) => {
      const w = walletByUser.get(e.id);
      const t = tripsByUser.get(e.id) ?? { km: 0, trips: 0 };
      return {
        id: e.id,
        full_name: e.full_name ?? "—",
        joined_at: e.created_at,
        trips_count: t.trips,
        total_km: Number(t.km.toFixed(2)),
        points_balance: w?.points_balance ?? 0,
        lifetime_points: w?.lifetime_points ?? 0,
      };
    });
  });

// --------------- ADMIN ---------------

async function assertAdmin(supabase: any, userId: string) {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isAdmin = roles?.some((r: any) => r.role === "admin");
  if (!isAdmin) throw new Error("Accesso riservato agli amministratori");
}

export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [
      { count: users },
      { count: companies },
      { count: bikes },
      { count: pendingPayouts },
      { count: activeSubs },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("companies").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("bikes").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("payout_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseAdmin
        .from("company_subscriptions")
        .select("id", { count: "exact", head: true })
        .in("status", ["active", "trial"]),
    ]);
    return {
      users: users ?? 0,
      companies: companies ?? 0,
      bikes: bikes ?? 0,
      pending_payouts: pendingPayouts ?? 0,
      active_subscriptions: activeSubs ?? 0,
    };
  });

export const adminListPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("payout_requests")
      .select("id, user_id, points_redeemed, amount_eur, status, iban_snapshot, created_at, admin_notes")
      .order("created_at", { ascending: false })
      .limit(100);

    const ids = Array.from(new Set((data ?? []).map((p) => p.user_id)));
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      profs?.forEach((p) => names.set(p.id, p.full_name ?? "—"));
    }
    return (data ?? []).map((p) => ({ ...p, user_name: names.get(p.user_id) ?? "—" }));
  });

const decideSchema = z.object({
  payout_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected", "paid"]),
  notes: z.string().max(500).optional(),
});

export const adminDecidePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => decideSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: payout } = await supabaseAdmin
      .from("payout_requests")
      .select("id, user_id, points_redeemed, amount_eur, status")
      .eq("id", data.payout_id)
      .maybeSingle();
    if (!payout) throw new Error("Richiesta non trovata");
    if (payout.status !== "pending" && data.decision !== "paid") {
      throw new Error("Richiesta già processata");
    }

    // Se rigettata, riaccredita i punti all'utente
    if (data.decision === "rejected") {
      const { data: w } = await supabaseAdmin
        .from("wallets")
        .select("points_balance, eur_balance")
        .eq("user_id", payout.user_id)
        .maybeSingle();
      if (w) {
        await supabaseAdmin
          .from("wallets")
          .update({
            points_balance: w.points_balance + payout.points_redeemed,
            eur_balance: Number((Number(w.eur_balance) + Number(payout.amount_eur)).toFixed(2)),
          })
          .eq("user_id", payout.user_id);
      }
    }

    const { error } = await supabaseAdmin
      .from("payout_requests")
      .update({
        status: data.decision,
        admin_notes: data.notes ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.payout_id);
    if (error) throw new Error("Aggiornamento fallito");

    return { ok: true };
  });

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    return { admin: !!roles?.some((r) => r.role === "admin") };
  });

// ---------- Approvazione enti (aziende / comuni) ----------

export const adminListPendingCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("companies")
      .select("id, name, kind, vat, iban, contact_email, code, status, rejection_reason, approved_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

const decideCompanySchema = z.object({
  company_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().max(500).optional(),
});

export const adminDecideCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => decideCompanySchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();
    const patch =
      data.decision === "approved"
        ? {
            status: "approved" as const,
            rejection_reason: null,
            approved_at: nowIso,
            approved_by: context.userId,
          }
        : {
            status: "rejected" as const,
            rejection_reason: data.reason ?? null,
          };
    const { error } = await supabaseAdmin.from("companies").update(patch).eq("id", data.company_id);
    if (error) throw new Error("Aggiornamento fallito");

    // Aggiorna la review pending più recente con esito + motivo
    const { data: latest } = await supabaseAdmin
      .from("company_reviews")
      .select("id")
      .eq("company_id", data.company_id)
      .eq("status", "pending")
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest) {
      await supabaseAdmin
        .from("company_reviews")
        .update({
          status: data.decision,
          reason: data.decision === "rejected" ? (data.reason ?? null) : null,
          reviewed_by: context.userId,
          reviewed_at: nowIso,
        })
        .eq("id", latest.id);
    }

    // Marca come lette le notifiche legate a questo ente
    await supabaseAdmin
      .from("admin_notifications")
      .update({ read_at: nowIso })
      .is("read_at", null)
      .eq("company_id", data.company_id);

    return { ok: true };
  });

// ---------- Notifiche admin ----------

export const adminListNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("admin_notifications")
      .select("id, type, title, body, payload, company_id, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const adminMarkNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();
    let q = supabaseAdmin.from("admin_notifications").update({ read_at: nowIso }).is("read_at", null);
    if (!data.all && data.id) q = q.eq("id", data.id);
    const { error } = await q;
    if (error) throw new Error("Aggiornamento fallito");
    return { ok: true };
  });

export const adminListCompanyReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ company_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("company_reviews")
      .select("id, kind, status, reason, notes, documents, submitted_at, reviewed_at")
      .eq("company_id", data.company_id)
      .order("submitted_at", { ascending: false });
    return rows ?? [];
  });

/* ─────────────────  Coda anti-frode (trip_flags)  ───────────────── */

export const adminListTripFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: flags } = await supabaseAdmin
      .from("trip_flags")
      .select("id, trip_id, user_id, score, declared_mode, predicted_mode, reason, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!flags?.length) return [];

    const userIds = [...new Set(flags.map((f) => f.user_id))];
    const tripIds = [...new Set(flags.map((f) => f.trip_id))];
    const [{ data: profiles }, { data: trips }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds),
      supabaseAdmin.from("trips").select("id, distance_km, points_earned, started_at").in("id", tripIds),
    ]);
    const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const tripOf = new Map((trips ?? []).map((t) => [t.id, t]));

    return flags.map((f) => ({
      ...f,
      user_name: nameOf.get(f.user_id) ?? "—",
      distance_km: Number(tripOf.get(f.trip_id)?.distance_km ?? 0),
      points_earned: tripOf.get(f.trip_id)?.points_earned ?? 0,
      started_at: tripOf.get(f.trip_id)?.started_at ?? f.created_at,
    }));
  });

export const adminDecideTripFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ flag_id: z.string().uuid(), decision: z.enum(["confirmed", "dismissed"]) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: flag } = await supabaseAdmin
      .from("trip_flags")
      .select("id, trip_id, user_id, status")
      .eq("id", data.flag_id)
      .maybeSingle();
    if (!flag) throw new Error("Segnalazione non trovata");
    if (flag.status !== "pending") throw new Error("Segnalazione già gestita");

    if (data.decision === "confirmed") {
      // Frode confermata: revoca i punti del viaggio.
      const { data: trip } = await supabaseAdmin
        .from("trips")
        .select("id, points_earned")
        .eq("id", flag.trip_id)
        .maybeSingle();
      const pts = trip?.points_earned ?? 0;
      if (pts > 0) {
        const { data: wallet } = await supabaseAdmin
          .from("wallets")
          .select("points_balance, lifetime_points")
          .eq("user_id", flag.user_id)
          .maybeSingle();
        await supabaseAdmin
          .from("wallets")
          .update({
            points_balance: Math.max(0, (wallet?.points_balance ?? 0) - pts),
            lifetime_points: Math.max(0, (wallet?.lifetime_points ?? 0) - pts),
          })
          .eq("user_id", flag.user_id);
        await supabaseAdmin.from("point_transactions").insert({
          user_id: flag.user_id,
          delta_points: -pts,
          delta_eur: 0,
          reason: "fraud_revoke",
          trip_id: flag.trip_id,
        });
        await supabaseAdmin
          .from("trips")
          .update({ points_earned: 0, anomaly_flag: true, anomaly_reason: "Confermato da revisione admin" })
          .eq("id", flag.trip_id);
      }
    }

    const { error } = await supabaseAdmin
      .from("trip_flags")
      .update({
        status: data.decision,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", flag.id);
    if (error) throw new Error("Aggiornamento fallito");
    return { ok: true as const };
  });
