import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notifyUsers } from "@/lib/notifications.server";
import { clampModeToSpeed, type DetectorMode } from "@/lib/mode-detector";

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  t: z.number().int().positive(),
  s: z.number().min(0).max(200).optional(),
  m: z.enum(["foot", "bike", "car"]).optional(),
});

const endTripSchema = z.object({
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  mode: z.enum(["foot", "bike", "car"]),
  path: z.array(pointSchema).min(2).max(20000),
});

export type TripSummary = {
  id: string;
  distance_km: number;
  duration_s: number;
  points_earned: number;
  mode: string;
  // per riepilogo lato client
  started_at: string;
  ended_at: string;
  breakdown?: { bike_km: number; foot_km: number; car_km: number };
};

const EARTH_R = 6371; // km
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Termina un viaggio: ricalcola distanza e durata dal tracciato (anti-frode),
 * valida la velocità e assegna i punti con accredito atomico lato DB.
 *
 * Modello punti (per-segmento quando il client invia il mezzo per ogni fix):
 * - Bici: 10 pt per ogni km (intero) pedalato
 * - A piedi: 3 pt per OGNI blocco da 100 m camminati
 * - Auto: 0 pt
 *
 * Anti-frode: la velocità misurata su ogni segmento vincola il mezzo
 * accreditato (es. segmento "bici" a 60 km/h → auto, 0 punti).
 */
export const endTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => endTripSchema.parse(input))
  .handler(async ({ data, context }): Promise<TripSummary> => {
    const { supabase, userId } = context;

    const startedAt = new Date(data.started_at).getTime();
    const endedAt = new Date(data.ended_at).getTime();
    if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt <= startedAt) {
      throw new Error("Orari non validi");
    }

    // Ordina per timestamp e scarta duplicati/fuori ordine evidenti
    const points = [...data.path]
      .filter((p) => p.t >= startedAt - 60_000 && p.t <= endedAt + 60_000)
      .sort((a, b) => a.t - b.t);
    if (points.length < 2) throw new Error("Tracciato troppo corto");

    const durationS = Math.round((endedAt - startedAt) / 1000);
    if (durationS < 60) throw new Error("Viaggio troppo corto (min 1 minuto)");

    // Distanza ricalcolata server-side, scartando salti impossibili (> 150 km/h)
    let distanceKm = 0;
    let maxSpeedKmh = 0;
    let bikeKm = 0;
    let footM = 0;
    let carKm = 0;
    const hasHints = points.some((p) => p.m != null);

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const cur = points[i];
      const dtS = (cur.t - prev.t) / 1000;
      if (dtS <= 0) continue;
      const d = haversineKm(prev, cur);
      const speed = (d / dtS) * 3600;
      if (speed > 150) continue; // salto impossibile: ignora il segmento
      distanceKm += d;
      if (speed > maxSpeedKmh) maxSpeedKmh = speed;

      if (hasHints) {
        // mezzo dichiarato dal client al fix, vincolato alla velocità misurata
        const hint: DetectorMode = cur.m ?? prev.m ?? "foot";
        const validated = clampModeToSpeed(hint, speed);
        if (validated === "bike") bikeKm += d;
        else if (validated === "foot") footM += d * 1000;
        else carKm += d;
      }
    }

    const avgSpeed = durationS > 0 ? (distanceKm / durationS) * 3600 : 0;

    // Anomalie: velocità o mezzo incoerenti → trip salvato ma 0 punti + segnalazione
    const anomalies: string[] = [];
    if (maxSpeedKmh > 120) anomalies.push("velocità di picco anomala");
    if (avgSpeed > 60) anomalies.push("velocità media anomala");
    if (data.mode === "bike" && avgSpeed > 40) anomalies.push("bici troppo veloce");
    if (data.mode === "foot" && avgSpeed > 15) anomalies.push("a piedi troppo veloce");

    let validatedDominant: DetectorMode = data.mode;
    if (hasHints) {
      // mezzo dominante = quello con più km validati
      const entries: Array<[DetectorMode, number]> = [
        ["bike", bikeKm],
        ["foot", footM / 1000],
        ["car", carKm],
      ];
      entries.sort((a, b) => b[1] - a[1]);
      validatedDominant = entries[0][0];
      const hintedGreenKm = bikeKm + footM / 1000;
      // se il dominante dichiarato è green ma la maggioranza è auto → sospetto
      if (data.mode !== "car" && carKm > hintedGreenKm && carKm > 1) {
        anomalies.push("mezzo dichiarato non coerente con la velocità");
      }
    }

    // Punti
    let pointsEarned = 0;
    if (hasHints) {
      pointsEarned = Math.floor(bikeKm) * 10 + Math.floor(footM / 100) * 3;
    } else if (data.mode === "bike") {
      pointsEarned = Math.floor(distanceKm) * 10;
    } else if (data.mode === "foot") {
      pointsEarned = Math.floor((distanceKm * 1000) / 100) * 3;
    }

    const flagged = anomalies.length > 0 && pointsEarned > 0;
    if (flagged) pointsEarned = 0;

    const { data: rpcRows, error: rpcError } = await supabase.rpc("finalize_trip", {
      p_user_id: userId,
      p_mode: validatedDominant,
      p_started_at: data.started_at,
      p_ended_at: data.ended_at,
      p_distance_km: Math.round(distanceKm * 1000) / 1000,
      p_duration_s: durationS,
      p_avg_speed_kmh: Math.round(avgSpeed * 100) / 100,
      p_max_speed_kmh: Math.round(maxSpeedKmh * 100) / 100,
      p_path: JSON.parse(JSON.stringify(points)),
      p_points: pointsEarned,
    });

    if (rpcError) throw new Error(rpcError.message);
    const tripId = (rpcRows as Array<{ trip_id: string }> | null)?.[0]?.trip_id ?? "";

    if (flagged && tripId) {
      await supabase.from("trip_flags").insert({
        user_id: userId,
        trip_id: tripId,
        reason: anomalies.join("; "),
      });
    } else if (tripId) {
      // Aggiorna sfide attive con i km validati (bici → bike+total, piedi → foot+total)
      const kmBike = hasHints ? bikeKm : data.mode === "bike" ? distanceKm : 0;
      const kmFoot = hasHints ? footM / 1000 : data.mode === "foot" ? distanceKm : 0;
      try {
        if (kmBike > 0.05) {
          await supabase.rpc("apply_trip_to_challenges", {
            p_user_id: userId,
            p_trip_mode: "bike",
            p_distance_km: Math.round(kmBike * 1000) / 1000,
          });
        }
        if (kmFoot > 0.05) {
          await supabase.rpc("apply_trip_to_challenges", {
            p_user_id: userId,
            p_trip_mode: "foot",
            p_distance_km: Math.round(kmFoot * 1000) / 1000,
          });
        }
        if (kmBike > 0 || kmFoot > 0) {
          await supabase.rpc("bump_streak", { p_user_id: userId });
        }
      } catch {
        /* sfide opzionali */
      }
    }

    // Notifica punti guadagnati
    if (pointsEarned > 0) {
      void notifyUsers({
        event: "trip_points",
        userIds: [userId],
        title: `+${pointsEarned} punti`,
        body: `Viaggio ${validatedDominant === "bike" ? "in bici" : validatedDominant === "foot" ? "a piedi" : "in auto"} di ${distanceKm.toFixed(1)} km: +${pointsEarned} punti Cicla.`,
        url: "/app/punti",
      });
    }

    return {
      id: tripId,
      distance_km: Math.round(distanceKm * 1000) / 1000,
      duration_s: durationS,
      points_earned: pointsEarned,
      mode: validatedDominant,
      started_at: data.started_at,
      ended_at: data.ended_at,
      breakdown: {
        bike_km: Math.round(bikeKm * 1000) / 1000,
        foot_km: Math.round((footM / 1000) * 1000) / 1000,
        car_km: Math.round(carKm * 1000) / 1000,
      },
    };
  });

/**
 * Cronologia viaggi dell'utente, più recenti prima.
 */
export const listMyTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("trips")
      .select("id, mode, started_at, ended_at, distance_km, duration_s, points_earned")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
