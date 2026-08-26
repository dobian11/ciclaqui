import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { clampModeToSpeed, type Mode as DetectorMode } from "@/lib/mode-classifier";
import { computeTripPoints } from "@/lib/trip-points";
import { createServerLogger } from "@/lib/server-log";

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  t: z.number().int().nonnegative(), // ms epoch
  s: z.number().nonnegative().optional(), // km/h
  m: z.enum(["foot", "bike", "car"]).optional(), // mezzo classificato dal client al fix
});

const endTripSchema = z.object({
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  mode: z.enum(["foot", "bike", "car"]),
  path: z.array(pointSchema).min(2).max(20000),
});

// Haversine — km
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const MET: Record<"foot" | "bike" | "car", number> = { foot: 3.5, bike: 6.8, car: 1.3 };
const CO2_KG_PER_KM_CAR_AVOIDED = 0.18; // emissione media auto evitata

/**
 * Chiude un viaggio: calcola distanza/velocità lato server (anti-frode),
 * assegna punti in base ad app_config, aggiorna wallet in transazione,
 * registra point_transaction. Ritorna il riepilogo.
 *
 * Se il client invia il mezzo per ogni fix (`m`, dal rilevatore on-device),
 * i punti sono calcolati per segmento: bici 10 pt/km, piedi 3 pt/100 m,
 * auto 0 — con il mezzo dichiarato vincolato alla velocità misurata sul
 * segmento (anti-frode: un segmento "bici" a 60 km/h non dà punti bici).
 */
export const endTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => endTripSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const log = createServerLogger("endTrip", { userId });
    // Niente PII nei log: solo id troncato e metriche.
    const uid = userId.slice(0, 8);
    log.debug("received", {
      user: uid,
      pathPoints: data.path.length,
      declaredMode: data.mode,
    });

    // Carica config corrente
    const { data: cfg } = await supabaseAdmin
      .from("app_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    const pointsPerKm = {
      foot: cfg?.points_per_km_foot ?? 3,
      bike: cfg?.points_per_km_bike ?? 10,
      car: cfg?.points_per_km_car ?? 0,
    };
    const dailyCapKm = cfg?.daily_cap_km ?? 80;
    const eurPerPoint = cfg?.eur_per_point ?? 0.01;

    // Anti-frode: filtra punti con salti GPS implausibili (>250 km/h tra due fix)
    const cleaned: typeof data.path = [data.path[0]];
    for (let i = 1; i < data.path.length; i++) {
      const prev = cleaned[cleaned.length - 1];
      const cur = data.path[i];
      const dKm = distanceKm(prev, cur);
      const dtH = Math.max(1 / 3600, (cur.t - prev.t) / 3600000);
      const v = dKm / dtH;
      if (v > 250) continue; // scarta salto
      cleaned.push(cur);
    }

    if (cleaned.length < 2) {
      throw new Error("Tracciato non valido");
    }

    const hasHints = cleaned.some((p) => p.m != null);
    log.debug("path-cleaned", {
      user: uid,
      raw: data.path.length,
      kept: cleaned.length,
      dropped: data.path.length - cleaned.length,
      hasHints,
    });

    let distance = 0;
    let maxSpeed = 0;
    // Distanza per mezzo validato (solo se il client manda gli hint per-fix)
    let bikeKm = 0;
    let footM = 0;
    let carKm = 0;
    for (let i = 1; i < cleaned.length; i++) {
      const prev = cleaned[i - 1];
      const cur = cleaned[i];
      const dKm = distanceKm(prev, cur);
      distance += dKm;
      const dtS = Math.max(1, (cur.t - prev.t) / 1000);
      const segSpeed = (dKm / dtS) * 3600;
      const s = cur.s ?? segSpeed;
      if (s > maxSpeed) maxSpeed = s;

      if (hasHints) {
        // Mezzo dichiarato al fix, vincolato alla velocità misurata sul segmento
        const hint: DetectorMode = cur.m ?? prev.m ?? "foot";
        const validated = clampModeToSpeed(hint, segSpeed);
        if (validated === "bike") bikeKm += dKm;
        else if (validated === "foot") footM += dKm * 1000;
        else carKm += dKm;
      }
    }

    // Recupero segmenti "auto" spuri dentro una pedalata: un tratto breve
    // rilevato come auto (discesa, e-bike/cargo, picco GPS) in un viaggio
    // chiaramente in bici viene riportato a bici, purché nessun segmento
    // superi la velocità massima plausibile per una bici.
    if (hasHints && carKm > 0 && bikeKm >= 1 && maxSpeed <= 50) {
      const spurious = Math.min(1, bikeKm * 0.3);
      if (carKm <= spurious) {
        log.info("car-segment-recovered", {
          user: uid,
          carKm: Math.round(carKm * 1000) / 1000,
          bikeKm: Math.round(bikeKm * 1000) / 1000,
        });
        bikeKm += carKm;
        carKm = 0;
      }
    }



    // Durata "attiva": somma degli intervalli tra fix GPS, escludendo le pause
    // (app sospesa / viaggio ripreso) più lunghe di IDLE_GAP_MS.
    const IDLE_GAP_MS = 120000;
    let activeMs = 0;
    for (let i = 1; i < cleaned.length; i++) {
      const dt = cleaned[i].t - cleaned[i - 1].t;
      if (dt > 0 && dt <= IDLE_GAP_MS) activeMs += dt;
    }
    const wallMs = new Date(data.ended_at).getTime() - new Date(data.started_at).getTime();
    const durationMs = Math.max(1000, Math.min(activeMs > 0 ? activeMs : wallMs, wallMs));
    const durationH = Math.max(0.001, durationMs / 3600000);
    const avgSpeed = distance / durationH;

    // Mezzo effettivo: con gli hint per-fix è quello con più km validati,
    // altrimenti quello dichiarato dal client.
    let effectiveMode: DetectorMode = data.mode;
    if (hasHints && distance > 0) {
      const entries: Array<[DetectorMode, number]> = [
        ["bike", bikeKm],
        ["foot", footM / 1000],
        ["car", carKm],
      ];
      entries.sort((a, b) => b[1] - a[1]);
      effectiveMode = entries[0][0];
    }

    // Anti-frode mode plausibility
    let anomaly = false;
    let anomalyReason: string | null = null;
    if (effectiveMode === "foot" && maxSpeed > 20) {
      anomaly = true;
      anomalyReason = "Velocità max troppo alta per spostamento a piedi";
    }
    if (effectiveMode === "bike" && maxSpeed > 70) {
      anomaly = true;
      anomalyReason = "Velocità max troppo alta per la bici";
    }
    if (
      hasHints &&
      data.mode !== "car" &&
      carKm > bikeKm + footM / 1000 &&
      carKm > 1
    ) {
      anomaly = true;
      anomalyReason = "Mezzo dichiarato non coerente con la velocità misurata";
    }
    if (anomaly) {
      log.warn("anomaly", {
        user: uid,
        reason: anomalyReason,
        effectiveMode,
        maxSpeedKmh: Math.round(maxSpeed * 10) / 10,
        bikeKm: Math.round(bikeKm * 1000) / 1000,
        carKm: Math.round(carKm * 1000) / 1000,
      });
    }

    // Cap giornaliero
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: todayTrips } = await supabaseAdmin
      .from("trips")
      .select("distance_km, mode")
      .eq("user_id", userId)
      .gte("started_at", today.toISOString());
    const kmToday = (todayTrips ?? []).reduce((s, t: any) => s + (t.distance_km ?? 0), 0);
    const eligibleKm = Math.max(0, Math.min(distance, dailyCapKm - kmToday));
    const eligibleRatio = distance > 0 ? eligibleKm / distance : 0;

    // Punti: logica pura e testata in src/lib/trip-points.ts
    // Bici 10 pt/km (frazioni incluse) · piedi 3 pt ogni 100 m · auto 0.
    const points = computeTripPoints({
      anomaly,
      hasHints,
      bikeKm,
      footM,
      eligibleRatio,
      eligibleKm,
      mode: data.mode,
      pointsPerKm,
    });
    // Traccia completa del calcolo: è la riga da cercare in QA per capire
    // perché un viaggio ha dato X punti (km per mezzo, ramo, cap, tariffe).
    log.info("scored", {
      user: uid,
      hasHints,
      bikeKm: Math.round(bikeKm * 1000) / 1000,
      footM: Math.round(footM),
      carKm: Math.round(carKm * 1000) / 1000,
      eligibleKm: Math.round(eligibleKm * 1000) / 1000,
      eligibleRatio: Math.round(eligibleRatio * 1000) / 1000,
      kmToday: Math.round(kmToday * 100) / 100,
      dailyCapKm,
      pointsPerKm,
      points,
      effectiveMode,
      maxSpeedKmh: Math.round(maxSpeed * 10) / 10,
      anomaly,
    });
    // Spia QA: distanza eleggibile green ma 0 punti → quasi sempre un bug.
    if (
      !anomaly &&
      points === 0 &&
      eligibleRatio > 0.5 &&
      (bikeKm >= 0.2 || footM >= 200)
    ) {
      log.warn("zero-points-unexpected", {
        user: uid,
        bikeKm: Math.round(bikeKm * 1000) / 1000,
        footM: Math.round(footM),
        eligibleRatio: Math.round(eligibleRatio * 1000) / 1000,
        pointsPerKm,
      });
    }
    const calories = Math.round((MET[effectiveMode] * 3.5 * 70 * (durationMs / 60000)) / 200);
    const co2Saved = effectiveMode === "car" ? 0 : distance * CO2_KG_PER_KM_CAR_AVOIDED;

    // Inserisci viaggio
    const { data: trip, error: tripErr } = await supabaseAdmin
      .from("trips")
      .insert({
        user_id: userId,
        started_at: data.started_at,
        ended_at: data.ended_at,
        mode: effectiveMode,
        distance_km: Math.round(distance * 1000) / 1000,
        avg_speed_kmh: Math.round(avgSpeed * 10) / 10,
        max_speed_kmh: Math.round(maxSpeed * 10) / 10,
        calories,
        co2_saved_kg: Math.round(co2Saved * 1000) / 1000,
        points_earned: points,
        anomaly_flag: anomaly,
        anomaly_reason: anomalyReason,
        path: { coords: cleaned } as any,
      })
      .select()
      .single();

    if (tripErr || !trip) {
      log.error("insert-failed", { user: uid, message: tripErr?.message ?? "nessuna riga" });
      await log.flush();
      throw new Error("Impossibile salvare il viaggio");
    }

    // Coda di revisione anti-frode: registra la segnalazione per l'admin
    if (anomaly) {
      const predicted = maxSpeed > 45 ? "car" : maxSpeed > 20 ? "bike" : "foot";
      const { data: prof0 } = await supabaseAdmin
        .from("profiles")
        .select("company_id")
        .eq("id", userId)
        .maybeSingle();
      await supabaseAdmin.from("trip_flags").insert({
        trip_id: trip.id,
        user_id: userId,
        company_id: prof0?.company_id ?? null,
        score: Math.min(1, maxSpeed / 100),
        declared_mode: data.mode,
        predicted_mode: predicted,
        reason: anomalyReason,
        status: "pending",
      });

      try {
        const { notifyUsers, companyManagerIds } = await import("@/lib/notify.server");
        await notifyUsers({
          userIds: [userId],
          topic: "trip_flag",
          type: "trip_flagged",
          title: "Viaggio da verificare",
          body: `Il viaggio appena concluso è in verifica (${anomalyReason ?? "anomalia rilevata"}). I punti verranno accreditati dopo il controllo.`,
          url: "/app/punti",
          companyId: prof0?.company_id ?? null,
          ctaLabel: "Vedi i tuoi viaggi",
          payload: { trip_id: trip.id, ref: trip.id },
        });
        if (prof0?.company_id) {
          await notifyUsers({
            userIds: await companyManagerIds(prof0.company_id),
            topic: "trip_flag",
            type: "trip_flag_review",
            title: "Viaggio da rivedere",
            body: `Un viaggio di un membro è stato segnalato (${anomalyReason ?? "anomalia"}). Verificalo dalla sezione "Da verificare".`,
            url: "/azienda",
            companyId: prof0.company_id,
            ctaLabel: "Apri la dashboard ente",
            payload: { trip_id: trip.id, ref: trip.id },
          });
        }
      } catch (e) {
        log.error("notify-flag-failed", { user: uid, message: (e as Error)?.message ?? String(e) });
      }
    }

    // Accredito atomico: point_transaction + wallet in un'unica operazione
    // lato DB (incrementale, niente read-modify-write → nessun punto perso
    // in caso di viaggi simultanei o wallet mancante).
    const { error: creditErr } = await supabaseAdmin.rpc("credit_trip_points", {
      _user_id: userId,
      _trip_id: trip.id,
      _points: points,
      _eur_per_point: eurPerPoint,
      _distance_km: distance,
    } as any);
    if (creditErr) {
      log.error("credit-failed", { user: uid, tripId: trip.id, points, message: creditErr.message });
      await log.flush();
      throw new Error("Viaggio salvato ma accredito punti fallito, riprova");
    }

    // ── Gamification: streak + sfide attive ────────────────
    // Con hint per-fix: contribuiscono i km validati per ciascun mezzo green.
    try {
      await supabaseAdmin.rpc("bump_streak", { _user_id: userId, _mode: effectiveMode });
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("company_id")
        .eq("id", userId)
        .maybeSingle();
      const companyId = prof?.company_id ?? undefined;

      if (hasHints) {
        const kmBike = Math.round(bikeKm * 1000) / 1000;
        const kmFoot = Math.round(footM / 10) / 100;
        if (kmBike > 0.05) {
          await supabaseAdmin.rpc("apply_trip_to_challenges", {
            _user_id: userId,
            _mode: "bike",
            _distance_km: kmBike,
            _company_id: companyId,
            _count_trip: true,
          } as any);
        }
        if (kmFoot > 0.05) {
          await supabaseAdmin.rpc("apply_trip_to_challenges", {
            _user_id: userId,
            _mode: "foot",
            _distance_km: kmFoot,
            _company_id: companyId,
            // il viaggio è già stato conteggiato dal ramo bici, se presente
            _count_trip: kmBike <= 0.05,
          } as any);
        }
      } else {
        await supabaseAdmin.rpc("apply_trip_to_challenges", {
          _user_id: userId,
          _mode: data.mode,
          _distance_km: distance,
          _company_id: companyId,
        } as any);
      }
    } catch (e) {
      log.error("gamification-failed", { user: uid, message: (e as Error)?.message ?? String(e) });
    }

    await log.flush();

    return {
      id: trip.id,
      distance_km: trip.distance_km,
      points_earned: points,
      calories,
      co2_saved_kg: trip.co2_saved_kg,
      anomaly,
      anomaly_reason: anomalyReason,
      mode: effectiveMode,
      breakdown: {
        bike_km: Math.round(bikeKm * 1000) / 1000,
        foot_km: Math.round((footM / 1000) * 1000) / 1000,
        car_km: Math.round(carKm * 1000) / 1000,
      },
    };
  });


/**
 * Config punti pubblica (non sensibile): serve al client per l'anteprima
 * live dei punti durante il tracking. Non richiede autenticazione.
 */
export const getPointsConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cfg } = await supabaseAdmin
    .from("app_config")
    .select("points_per_km_bike, points_per_km_foot, points_per_km_car, daily_cap_km")
    .eq("id", 1)
    .maybeSingle();
  return {
    foot: cfg?.points_per_km_foot ?? 3,
    bike: cfg?.points_per_km_bike ?? 10,
    car: cfg?.points_per_km_car ?? 0,
    dailyCapKm: Number(cfg?.daily_cap_km ?? 50),
  };
});

/** Lista viaggi recenti dell'utente (per la sezione punti). */
export const listMyTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("trips")
      .select("id, started_at, ended_at, mode, distance_km, points_earned, calories, anomaly_flag")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(20);
    return data ?? [];
  });
