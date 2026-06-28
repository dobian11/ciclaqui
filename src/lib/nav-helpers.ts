/**
 * Helper puri usati dalla navigazione live in mappa.
 * Estratti da `routes/_authenticated/app.index.tsx` per renderli testabili
 * senza dover montare React / Google Maps / GPS.
 *
 * Le soglie sono replicate qui ESATTAMENTE come nel componente, così i test
 * difendono il comportamento reale dell'app.
 */

export type LatLng = { lat: number; lng: number };

// ── Soglie navigazione (devono restare in sync con app.index.tsx) ──
export const NAV = {
  ARRIVED_M: 25,
  ARRIVED_MAX_M: 80,
  OFFROUTE_M: 20,
  RECALC_COOLDOWN_MS: 10_000,
  ARRIVAL_CONFIRM_FIXES: 2,
  ARRIVAL_DWELL_MS: 8_000,
  DWELL_RADIUS_M: 60,
  POOR_ACCURACY_M: 50,
  MOVE_START_KMH: 2.5,
  IDLE_STOP_MS: 3 * 60_000,
  MIN_DURATION_S: 30,
} as const;

/** Distanza haversine in metri. */
export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Soglia "arrivato" adattiva: con GPS impreciso si allarga, ma è cappata
 * a `ARRIVED_MAX_M` per evitare falsi positivi.
 */
export function effectiveArrivedThresholdM(accuracyM: number | null): number {
  const acc = accuracyM ?? 0;
  return Math.min(NAV.ARRIVED_MAX_M, Math.max(NAV.ARRIVED_M, acc * 0.8));
}

/** Indice del nodo del percorso più vicino al punto corrente + distanza in metri. */
export function nearestPathNode(
  current: LatLng,
  path: LatLng[],
): { index: number; distanceM: number } {
  let nearestIdx = 0;
  let nearestDist = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = haversineM(current, path[i]);
    if (d < nearestDist) {
      nearestDist = d;
      nearestIdx = i;
    }
  }
  return { index: nearestIdx, distanceM: nearestDist };
}

/**
 * Quando ritagliare il polyline residuo: solo se siamo avanzati di almeno
 * 2 nodi, per non rerendere ad ogni jitter GPS.
 */
export function shouldTrimPath(nearestIdx: number): boolean {
  return nearestIdx >= 2;
}

/**
 * Decide se far partire un ricalcolo del percorso: deviazione oltre soglia,
 * GPS sufficientemente preciso, nessun ricalcolo in volo, lock non attivo.
 */
export function shouldRecalcRoute(opts: {
  nearestDistanceM: number;
  accuracyM: number | null;
  recalcLocked: boolean;
  recalcInFlight: boolean;
}): boolean {
  const acc = opts.accuracyM ?? 0;
  return (
    opts.nearestDistanceM > NAV.OFFROUTE_M &&
    acc <= NAV.POOR_ACCURACY_M &&
    !opts.recalcLocked &&
    !opts.recalcInFlight
  );
}

/**
 * Conferma "arrivato" per fix consecutivi entro soglia adattiva.
 * Ritorna lo stato aggiornato del contatore + se l'arrivo è confermato.
 * Se l'accuracy è peggiore di POOR_ACCURACY_M il contatore viene azzerato.
 */
export function updateArrivalFixCounter(opts: {
  distanceToDestM: number;
  accuracyM: number | null;
  previousCount: number;
}): { count: number; arrived: boolean } {
  const acc = opts.accuracyM ?? 0;
  const threshold = effectiveArrivedThresholdM(opts.accuracyM);
  if (opts.distanceToDestM <= threshold && acc <= NAV.POOR_ACCURACY_M) {
    const count = opts.previousCount + 1;
    return { count, arrived: count >= NAV.ARRIVAL_CONFIRM_FIXES };
  }
  return { count: 0, arrived: false };
}

/**
 * Fallback "dwell": utente fermo (<2 km/h) entro raggio allargato per X ms.
 * `prevDwellStart` è il timestamp di inizio dwell (null = non in dwell).
 * Ritorna il nuovo timestamp di dwell + se l'arrivo è confermato.
 */
export function updateArrivalDwell(opts: {
  distanceToDestM: number;
  speedKmh: number;
  now: number;
  prevDwellStart: number | null;
}): { dwellStart: number | null; arrived: boolean } {
  const stationary = opts.speedKmh < 2;
  if (opts.distanceToDestM <= NAV.DWELL_RADIUS_M && stationary) {
    const start = opts.prevDwellStart ?? opts.now;
    return {
      dwellStart: start,
      arrived: opts.now - start >= NAV.ARRIVAL_DWELL_MS,
    };
  }
  return { dwellStart: null, arrived: false };
}

/**
 * Lunghezza residua del percorso = tratto corrente→primo nodo + somma nodi.
 * ETA stimato proporzionalmente alla distanza originale.
 */
export function computeLiveRouteInfo(opts: {
  current: LatLng;
  path: LatLng[];
  originalDistanceM: number;
  originalDurationSec: number;
}): { distanceMeters: number; durationSec: number } | null {
  if (!opts.path.length) return null;
  let m = haversineM(opts.current, opts.path[0]);
  for (let i = 1; i < opts.path.length; i++) {
    m += haversineM(opts.path[i - 1], opts.path[i]);
  }
  const ratio = opts.originalDistanceM > 0 ? m / opts.originalDistanceM : 1;
  const sec = Math.max(
    15,
    Math.round(opts.originalDurationSec * Math.min(1, ratio)),
  );
  return { distanceMeters: m, durationSec: sec };
}
