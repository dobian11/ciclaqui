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
    const { data: ownsCompany } = await supabase.rpc("owns_company", {
      _company_id: profile.company_id,
    });
    if (!ownsCompany) throw new Error("Accesso riservato al titolare dell'ente");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Gli account manager/titolari dell'ente non sono dipendenti: vanno esclusi
    // dall'elenco e dai conteggi.
    const { data: managerRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "company_manager");
    const managerIds = new Set((managerRows ?? []).map((r) => r.user_id));

    const { data: allProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, created_at")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });

    const employees = (allProfiles ?? []).filter((e) => !managerIds.has(e.id));

    if (!employees || employees.length === 0) return [];

    const ids = employees.map((e) => e.id);
    const [{ data: wallets }, { data: trips }, { data: badges }] = await Promise.all([
      supabaseAdmin
        .from("wallets")
        .select("user_id, points_balance, lifetime_points, lifetime_km")
        .in("user_id", ids),
      supabaseAdmin
        .from("trips")
        .select("user_id, distance_km, mode, co2_saved_kg")
        .in("user_id", ids),
      supabaseAdmin.from("badges").select("user_id").in("user_id", ids),
    ]);

    const tripsByUser = new Map<
      string,
      { km: number; trips: number; bike_km: number; foot_km: number; co2: number }
    >();
    (trips ?? []).forEach((t) => {
      const cur =
        tripsByUser.get(t.user_id) ?? { km: 0, trips: 0, bike_km: 0, foot_km: 0, co2: 0 };
      const km = Number(t.distance_km ?? 0);
      cur.km += km;
      cur.trips += 1;
      cur.co2 += Number(t.co2_saved_kg ?? 0);
      if (t.mode === "bike") cur.bike_km += km;
      if (t.mode === "foot") cur.foot_km += km;
      tripsByUser.set(t.user_id, cur);
    });

    const badgeCount = new Map<string, number>();
    (badges ?? []).forEach((b) => badgeCount.set(b.user_id, (badgeCount.get(b.user_id) ?? 0) + 1));

    const walletByUser = new Map(wallets?.map((w) => [w.user_id, w]) ?? []);

    return employees.map((e) => {
      const w = walletByUser.get(e.id);
      const t = tripsByUser.get(e.id) ?? { km: 0, trips: 0, bike_km: 0, foot_km: 0, co2: 0 };
      return {
        id: e.id,
        full_name: e.full_name ?? "—",
        joined_at: e.created_at,
        trips_count: t.trips,
        total_km: Number(t.km.toFixed(2)),
        bike_km: Number(t.bike_km.toFixed(2)),
        foot_km: Number(t.foot_km.toFixed(2)),
        co2_saved_kg: Number(t.co2.toFixed(2)),
        badges_count: badgeCount.get(e.id) ?? 0,
        points_balance: w?.points_balance ?? 0,
        lifetime_points: w?.lifetime_points ?? 0,
      };
    });
  });

/**
 * Dettaglio completo di un membro dell'ente (km per mezzo, CO2, badge,
 * streak e ultimi viaggi). Riservato al titolare dell'ente di appartenenza.
 */
export const getMyEmployeeDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.company_id) throw new Error("Nessun ente associato");
    const { data: ownsCompany } = await supabase.rpc("owns_company", {
      _company_id: profile.company_id,
    });
    if (!ownsCompany) throw new Error("Accesso riservato al titolare dell'ente");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_url, created_at, company_id")
      .eq("id", data.user_id)
      .maybeSingle();
    if (!member || member.company_id !== profile.company_id) {
      throw new Error("Membro non trovato in questo ente");
    }

    const [{ data: wallet }, { data: trips }, { data: badges }, { data: streak }] =
      await Promise.all([
        supabaseAdmin
          .from("wallets")
          .select("points_balance, lifetime_points, lifetime_km")
          .eq("user_id", member.id)
          .maybeSingle(),
        supabaseAdmin
          .from("trips")
          .select("id, started_at, mode, distance_km, avg_speed_kmh, calories, co2_saved_kg, points_earned")
          .eq("user_id", member.id)
          .order("started_at", { ascending: false })
          .limit(200),
        supabaseAdmin
          .from("badges")
          .select("id, code, title, description, icon, earned_at")
          .eq("user_id", member.id)
          .order("earned_at", { ascending: false }),
        supabaseAdmin
          .from("streaks")
          .select("current_days, best_days, multiplier")
          .eq("user_id", member.id)
          .maybeSingle(),
      ]);

    const all = trips ?? [];
    const sum = (f: (t: (typeof all)[number]) => number) => all.reduce((a, t) => a + f(t), 0);
    const kmBy = (mode: string) =>
      Number(all.filter((t) => t.mode === mode).reduce((a, t) => a + Number(t.distance_km ?? 0), 0).toFixed(2));

    const since30 = Date.now() - 30 * 24 * 3600 * 1000;
    const km30 = Number(
      all
        .filter((t) => new Date(t.started_at).getTime() >= since30)
        .reduce((a, t) => a + Number(t.distance_km ?? 0), 0)
        .toFixed(2),
    );

    return {
      id: member.id,
      full_name: member.full_name ?? "—",
      avatar_url: member.avatar_url,
      joined_at: member.created_at,
      wallet: {
        points_balance: wallet?.points_balance ?? 0,
        lifetime_points: wallet?.lifetime_points ?? 0,
        lifetime_km: Number(wallet?.lifetime_km ?? 0),
      },
      totals: {
        trips: all.length,
        total_km: Number(sum((t) => Number(t.distance_km ?? 0)).toFixed(2)),
        bike_km: kmBy("bike"),
        foot_km: kmBy("foot"),
        car_km: kmBy("car"),
        km_last_30d: km30,
        co2_saved_kg: Number(sum((t) => Number(t.co2_saved_kg ?? 0)).toFixed(2)),
        calories: Math.round(sum((t) => Number(t.calories ?? 0))),
        points_earned: Math.round(sum((t) => Number(t.points_earned ?? 0))),
      },
      streak: {
        current_days: streak?.current_days ?? 0,
        best_days: streak?.best_days ?? 0,
        multiplier: Number(streak?.multiplier ?? 1),
      },
      badges: badges ?? [],
      recent_trips: all.slice(0, 12),
    };
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

    // Conserva il riferimento alla pratica prima della decisione: la procedura
    // atomica la chiude insieme allo stato dell'ente.
    const { data: latest } = await supabaseAdmin
      .from("company_reviews")
      .select("id")
      .eq("company_id", data.company_id)
      .eq("status", "pending")
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: decisionRow, error: decisionError } = await supabaseAdmin
      .rpc("admin_decide_company", {
        _company_id: data.company_id,
        _decision: data.decision,
        _reason: data.reason,
        _actor_id: context.userId,
      })
      .single();
    if (decisionError || decisionRow?.company_status !== data.decision) {
      throw new Error("Lo stato dell'ente non è stato salvato. Riprova.");
    }
    const nowIso = decisionRow.decided_at;

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, name, kind, code, contact_email, created_by")
      .eq("id", data.company_id)
      .maybeSingle();

    // Audit: chi ha modificato lo stato di verifica dell'ente
    {
      const { logCompanyAudit } = await import("@/lib/audit.server");
      await logCompanyAudit({
        company_id: data.company_id,
        action: data.decision === "approved" ? "company_approved" : "company_rejected",
        actor_id: context.userId,
        actor_role: "admin",
        review_id: latest?.id ?? null,
        reason: data.decision === "rejected" ? (data.reason ?? null) : null,
        details: { company_name: company?.name ?? null, code: company?.code ?? null },
      });
    }

    // Marca come lette le notifiche legate a questo ente
    await supabaseAdmin
      .from("admin_notifications")
      .update({ read_at: nowIso })
      .is("read_at", null)
      .eq("company_id", data.company_id);

    // ---- Notifica in-app ai referenti dell'ente ----
    const approved = data.decision === "approved";
    const isMuni = company?.kind === "municipality";
    const members = isMuni ? "cittadini" : "dipendenti";
    const nextStep = approved
      ? `Attiva l'abbonamento dal pannello ente: da quel momento il codice ${company?.code ?? ""} diventa operativo e potrai distribuirlo ai tuoi ${members}.`.trim()
      : "Aggiorna i dati, carica i documenti richiesti e invia una nuova richiesta di revisione dal pannello ente.";
    const title = approved
      ? `${company?.name ?? "Il tuo ente"} è stato approvato`
      : `Richiesta non approvata`;
    const body = approved
      ? `Verifica completata con esito positivo. ${nextStep}`
      : `Motivo: ${data.reason?.trim() || "nessun motivo specificato"}. ${nextStep}`;

    // Destinatari: creatore dell'ente + gestori collegati
    const recipients = new Set<string>();
    if (company?.created_by) recipients.add(company.created_by);
    const { data: managerProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("company_id", data.company_id);
    if (managerProfiles?.length) {
      const ids = managerProfiles.map((p) => p.id);
      const { data: managerRoles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "company_manager")
        .in("user_id", ids);
      for (const r of managerRoles ?? []) recipients.add(r.user_id);
    }

    if (recipients.size > 0) {
      await supabaseAdmin.from("user_notifications").insert(
        [...recipients].map((uid) => ({
          user_id: uid,
          company_id: data.company_id,
          type: approved ? "company_approved" : "company_rejected",
          title,
          body,
          payload: {
            decision: data.decision,
            decided_at: nowIso,
            reason: approved ? null : (data.reason ?? null),
            next_step: nextStep,
            code: approved ? (company?.code ?? null) : null,
          },
        })),
      );
    }

    // ---- Push nativa (Android/iOS) con fallback su email + in-app ----
    let push: { configured: boolean; sent: number; failed: number; tokens: number; error?: string } = {
      configured: false, sent: 0, failed: 0, tokens: 0,
    };
    if (recipients.size > 0) {
      try {
        const { sendPushToUsers } = await import("@/lib/push.server");
        push = await sendPushToUsers({
          userIds: [...recipients],
          title,
          body,
          preferenceKey: "push_company",
          data: {
            type: approved ? "company_approved" : "company_rejected",
            company_id: data.company_id,
            url: "/azienda",
          },
        });
      } catch (e) {
        push = { configured: true, sent: 0, failed: 0, tokens: 0, error: e instanceof Error ? e.message : "Errore push" };
      }

      if (push.configured && push.tokens > 0) {
        await supabaseAdmin.from("company_email_log").insert({
          company_id: data.company_id,
          review_id: latest?.id ?? null,
          template_name: "company-decision",
          channel: "push",
          decision: data.decision,
          recipient_email: `${push.tokens} dispositivo/i`,
          status: push.sent > 0 ? "sent" : "failed",
          error_message: push.sent > 0 ? null : (push.error ?? "Nessuna push consegnata").slice(0, 500),
          sent_by: context.userId,
        });
      }
    }

    // Email dell'account referente (può differire dall'email di contatto dell'ente)
    let ownerEmail: string | null = null;
    if (company?.created_by) {
      try {
        const { data: owner } = await supabaseAdmin.auth.admin.getUserById(company.created_by);
        ownerEmail = owner?.user?.email ?? null;
      } catch {
        ownerEmail = null;
      }
    }
    const emailRecipients: string[] = [
      ...new Set([company?.contact_email, ownerEmail].filter((e): e is string => !!e)),
    ];

    return {
      ok: true,
      push,
      email: company && emailRecipients.length > 0
        ? {
            recipient: emailRecipients[0],
            recipients: emailRecipients,
            companyName: company.name,
            kind: company.kind,
            decision: data.decision,
            decidedAt: nowIso,
            reason: approved ? null : (data.reason ?? null),
            code: approved ? company.code : null,
          }
        : null,
    };
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

/* ─────────────────  Centro verifiche enti (admin)  ───────────────── */

/**
 * Elenco completo degli enti con tutte le loro pratiche di verifica
 * (documenti inclusi) e i dati del referente che le ha inviate.
 * Alimenta la sezione admin "Verifiche enti".
 */
export const adminListVerifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: companies }, { data: reviews }] = await Promise.all([
      supabaseAdmin
        .from("companies")
        .select(
          "id, name, kind, vat, iban, contact_email, code, status, rejection_reason, approved_at, approved_by, created_at, created_by",
        )
        .order("created_at", { ascending: false })
        .limit(300),
      supabaseAdmin
        .from("company_reviews")
        .select(
          "id, company_id, kind, status, reason, notes, documents, submitted_at, submitted_by, reviewed_at, reviewed_by",
        )
        .order("submitted_at", { ascending: false })
        .limit(600),
    ]);

    const userIds = [
      ...new Set(
        [
          ...(companies ?? []).flatMap((c) => [c.created_by, c.approved_by]),
          ...(reviews ?? []).flatMap((r) => [r.submitted_by, r.reviewed_by]),
        ].filter(Boolean) as string[],
      ),
    ];
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "—"]));

    const reviewsByCompany = new Map<string, typeof reviews>();
    for (const r of reviews ?? []) {
      const list = reviewsByCompany.get(r.company_id) ?? [];
      list.push(r);
      reviewsByCompany.set(r.company_id, list as never);
    }

    return (companies ?? []).map((c) => {
      const list = (reviewsByCompany.get(c.id) ?? []) as NonNullable<typeof reviews>;
      const enriched = list.map((r) => ({
        ...r,
        documents: (Array.isArray(r.documents) ? r.documents : []) as {
          name: string;
          path: string;
          size?: number;
          content_type?: string;
        }[],
        submitted_by_name: r.submitted_by ? (nameOf.get(r.submitted_by) ?? "—") : "—",
        reviewed_by_name: r.reviewed_by ? (nameOf.get(r.reviewed_by) ?? "—") : null,
      }));
      const pending = enriched.find((r) => r.status === "pending") ?? null;
      return {
        ...c,
        owner_name: c.created_by ? (nameOf.get(c.created_by) ?? "—") : "—",
        approved_by_name: c.approved_by ? (nameOf.get(c.approved_by) ?? "—") : null,
        reviews: enriched,
        pending_review: pending,
        doc_count: pending?.documents.length ?? enriched[0]?.documents.length ?? 0,
        last_submitted_at: enriched[0]?.submitted_at ?? c.created_at,
      };
    });
  });

/**
 * Registro di audit consultabile: chi ha visto i documenti e chi ha
 * modificato lo stato di verifica degli enti.
 */
export const adminListAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        company_id: z.string().uuid().optional(),
        action: z
          .enum(["document_viewed", "company_approved", "company_rejected", "review_submitted"])
          .optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("company_audit_log")
      .select(
        "id, company_id, action, actor_id, actor_name, actor_role, document_name, document_path, review_id, reason, details, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.company_id) q = q.eq("company_id", data.company_id);
    if (data.action) q = q.eq("action", data.action);

    const { data: rows } = await q;
    const ids = [...new Set((rows ?? []).map((r) => r.company_id))];
    const { data: companies } = ids.length
      ? await supabaseAdmin.from("companies").select("id, name, kind").in("id", ids)
      : { data: [] as { id: string; name: string; kind: string }[] };
    const byId = new Map((companies ?? []).map((c) => [c.id, c]));

    return (rows ?? []).map((r) => ({
      ...r,
      company_name: byId.get(r.company_id)?.name ?? "—",
      company_kind: byId.get(r.company_id)?.kind ?? null,
    }));
  });

// ---------- Gestione utenti e ruoli ----------

const APP_ROLES = ["user", "company_manager", "admin"] as const;

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ query: z.string().trim().max(120).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const q = (data.query ?? "").trim();

    let profQuery = supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, company_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (q) profQuery = profQuery.ilike("full_name", `%${q}%`);
    const { data: profiles } = await profQuery;

    // Utenti auth (email + stato blocco)
    const { data: authList } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const authMap = new Map(
      (authList?.users ?? []).map((u) => [
        u.id,
        {
          email: u.email ?? "—",
          banned_until: (u as unknown as { banned_until?: string | null }).banned_until ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
        },
      ]),
    );

    let rows = profiles ?? [];
    if (q) {
      // include anche match per email
      const emailIds = (authList?.users ?? [])
        .filter((u) => (u.email ?? "").toLowerCase().includes(q.toLowerCase()))
        .map((u) => u.id);
      const missing = emailIds.filter((id) => !rows.some((r) => r.id === id));
      if (missing.length) {
        const { data: extra } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, phone, company_id, created_at")
          .in("id", missing);
        rows = [...rows, ...(extra ?? [])];
      }
    }

    const ids = rows.map((r) => r.id);
    const roleMap = new Map<string, string[]>();
    const companyMap = new Map<string, string>();
    if (ids.length) {
      const [{ data: roles }, { data: companies }] = await Promise.all([
        supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
        supabaseAdmin
          .from("companies")
          .select("id, name")
          .in(
            "id",
            Array.from(new Set(rows.map((r) => r.company_id).filter(Boolean))) as string[],
          ),
      ]);
      roles?.forEach((r) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role as string);
        roleMap.set(r.user_id, arr);
      });
      companies?.forEach((c) => companyMap.set(c.id, c.name));
    }

    const now = Date.now();
    return rows.map((r) => {
      const a = authMap.get(r.id);
      const bannedUntil = a?.banned_until ?? null;
      return {
        id: r.id,
        full_name: r.full_name ?? "—",
        email: a?.email ?? "—",
        phone: r.phone ?? null,
        company_name: r.company_id ? (companyMap.get(r.company_id) ?? null) : null,
        roles: roleMap.get(r.id) ?? [],
        created_at: r.created_at,
        last_sign_in_at: a?.last_sign_in_at ?? null,
        banned: !!bannedUntil && new Date(bannedUntil).getTime() > now,
        banned_until: bannedUntil,
      };
    });
  });

export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: z.enum(APP_ROLES),
        action: z.enum(["grant", "revoke"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId && data.role === "admin" && data.action === "revoke") {
      throw new Error("Non puoi rimuovere il tuo ruolo admin");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.action === "grant") {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.user_id, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminSetUserBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), blocked: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("Non puoi bloccare il tuo account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.blocked ? "876000h" : "none",
    });
    if (error) throw new Error(error.message);
    return { ok: true, blocked: data.blocked };
  });

/* ---------------------------------------------------------------------- */
/* Codici sconto (fase test / partner)                                     */
/* ---------------------------------------------------------------------- */

export const adminListDiscountCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ok } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!ok) throw new Error("Accesso riservato agli admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("discount_codes")
      .select("id, code, label, percent_off, plan, max_redemptions, redeemed_count, expires_at, active, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const adminCreateDiscountCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string().trim().min(3).max(40),
        label: z.string().trim().max(120).optional(),
        percent_off: z.number().int().min(1).max(100).default(100),
        plan: z.enum(["starter", "pro", "enterprise"]).nullable().optional(),
        max_redemptions: z.number().int().min(1).max(100000).nullable().optional(),
        expires_at: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!ok) throw new Error("Accesso riservato agli admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin
      .from("discount_codes")
      .insert({
        code: data.code.toUpperCase(),
        label: data.label || null,
        percent_off: data.percent_off,
        plan: data.plan ?? null,
        max_redemptions: data.max_redemptions ?? null,
        expires_at: data.expires_at || null,
        created_by: context.userId,
      })
      .select("id, code")
      .single();
    if (error) {
      throw new Error(
        error.code === "23505" ? "Esiste già un codice con questo nome" : "Impossibile creare il codice",
      );
    }
    return created;
  });

export const adminToggleDiscountCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!ok) throw new Error("Accesso riservato agli admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("discount_codes")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error("Impossibile aggiornare il codice");
    return { ok: true as const };
  });
