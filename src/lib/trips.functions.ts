import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  t: z.number().int().nonnegative(), // ms epoch
  s: z.number().nonnegative().optional(), // km/h
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
 */
export const endTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => endTripSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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

    let distance = 0;
    let maxSpeed = 0;
    for (let i = 1; i < cleaned.length; i++) {
      const dKm = distanceKm(cleaned[i - 1], cleaned[i]);
      distance += dKm;
      const s = cleaned[i].s ?? 0;
      if (s > maxSpeed) maxSpeed = s;
    }

    const durationMs = new Date(data.ended_at).getTime() - new Date(data.started_at).getTime();
    const durationH = Math.max(0.001, durationMs / 3600000);
    const avgSpeed = distance / durationH;

    // Anti-frode mode plausibility
    let anomaly = false;
    let anomalyReason: string | null = null;
    if (data.mode === "foot" && maxSpeed > 20) {
      anomaly = true;
      anomalyReason = "Velocità max troppo alta per spostamento a piedi";
    }
    if (data.mode === "bike" && maxSpeed > 70) {
      anomaly = true;
      anomalyReason = "Velocità max troppo alta per la bici";
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

    let points = anomaly ? 0 : Math.floor(eligibleKm * pointsPerKm[data.mode]);
    const calories = Math.round((MET[data.mode] * 3.5 * 70 * (durationMs / 60000)) / 200);
    const co2Saved = data.mode === "car" ? 0 : distance * CO2_KG_PER_KM_CAR_AVOIDED;

    // Inserisci viaggio
    const { data: trip, error: tripErr } = await supabaseAdmin
      .from("trips")
      .insert({
        user_id: userId,
        started_at: data.started_at,
        ended_at: data.ended_at,
        mode: data.mode,
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
      console.error("[endTrip] insert failed", tripErr);
      throw new Error("Impossibile salvare il viaggio");
    }

    // Aggiorna wallet + transazione punti
    if (points > 0) {
      await supabaseAdmin.from("point_transactions").insert({
        user_id: userId,
        trip_id: trip.id,
        delta_points: points,
        delta_eur: Math.round(points * eurPerPoint * 100) / 100,
        reason: "trip",
      });
      const { data: wallet } = await supabaseAdmin
        .from("wallets")
        .select("points_balance, lifetime_points, lifetime_km, eur_balance")
        .eq("user_id", userId)
        .maybeSingle();
      await supabaseAdmin
        .from("wallets")
        .update({
          points_balance: (wallet?.points_balance ?? 0) + points,
          lifetime_points: (wallet?.lifetime_points ?? 0) + points,
          lifetime_km: Math.round(((wallet?.lifetime_km ?? 0) + distance) * 100) / 100,
          eur_balance:
            Math.round(((wallet?.eur_balance ?? 0) + points * eurPerPoint) * 100) / 100,
        })
        .eq("user_id", userId);
    } else {
      // aggiorna solo km lifetime
      const { data: wallet } = await supabaseAdmin
        .from("wallets")
        .select("lifetime_km")
        .eq("user_id", userId)
        .maybeSingle();
      await supabaseAdmin
        .from("wallets")
        .update({
          lifetime_km: Math.round(((wallet?.lifetime_km ?? 0) + distance) * 100) / 100,
        })
        .eq("user_id", userId);
    }

    return {
      id: trip.id,
      distance_km: trip.distance_km,
      points_earned: points,
      calories,
      co2_saved_kg: trip.co2_saved_kg,
      anomaly,
      anomaly_reason: anomalyReason,
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
