/**
 * Calcolo punti viaggio — funzione pura, testabile.
 *
 * Regole:
 * - Bici: pointsPerKm.bike punti per km (es. 10 pt/km → 2,9 km = 29 pt).
 *   Si moltiplica PRIMA e si arrotonda per difetto solo il punteggio finale,
 *   così le frazioni di km non vanno perse.
 * - Piedi: pointsPerKm.foot punti per ogni BLOCCO da 100 m completati
 *   (es. 3 pt/100 m → 137 m = 3 pt, 99 m = 0 pt).
 * - Auto: 0 punti.
 * - Viaggio segnalato come anomalo: 0 punti (accredito dopo revisione).
 * - Cap giornaliero: con hint per-fix la quota eleggibile è proporzionale
 *   ai km di ciascun mezzo (eligibleRatio).
 */

export interface PointsPerKm {
  foot: number;
  bike: number;
  car: number;
}

export interface TripPointsInput {
  anomaly: boolean;
  hasHints: boolean;
  /** km bici validati (solo con hint per-fix) */
  bikeKm: number;
  /** metri a piedi validati (solo con hint per-fix) */
  footM: number;
  /** quota eleggibile dopo cap giornaliero, 0..1 (solo con hint per-fix) */
  eligibleRatio: number;
  /** km eleggibili dopo cap (solo senza hint) */
  eligibleKm: number;
  /** mezzo dichiarato (solo senza hint) */
  mode: "foot" | "bike" | "car";
  pointsPerKm: PointsPerKm;
}

export function computeTripPoints(input: TripPointsInput): number {
  const { pointsPerKm } = input;
  if (input.anomaly) return 0;

  if (input.hasHints) {
    const elBikeKm = input.bikeKm * input.eligibleRatio;
    const elFootM = input.footM * input.eligibleRatio;
    const bikePts = Math.floor(elBikeKm * pointsPerKm.bike);
    const footPts = Math.floor(elFootM / 100) * pointsPerKm.foot;
    return bikePts + footPts;
  }

  if (input.mode === "foot") {
    // blocchi da 100 m = eligibleKm * 10
    return Math.floor(input.eligibleKm * 10) * pointsPerKm.foot;
  }
  return Math.floor(input.eligibleKm * pointsPerKm[input.mode]);
}

/**
 * Anteprima live lato client: stima i punti del viaggio in corso dai km
 * per mezzo accumulati on-device, con la STESSA formula del server
 * (ramo hasHints, quota cap 100%, nessuna anomalia).
 * Il valore definitivo resta quello calcolato dal server al salvataggio:
 * il server ri-valida i segmenti e applica cap giornaliero e anti-frode.
 */
export function computeLivePointsPreview(
  distanceByMode: { foot: number; bike: number; car: number },
  pointsPerKm: PointsPerKm,
): number {
  const bikePts = Math.floor(distanceByMode.bike * pointsPerKm.bike);
  const footPts = Math.floor(distanceByMode.foot * 10) * pointsPerKm.foot;
  return bikePts + footPts;
}
