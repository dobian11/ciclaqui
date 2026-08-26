/**
 * Rilevamento del mezzo di trasporto in streaming (GPS only, nessuna dipendenza).
 *
 * Progettato per la demo dal vivo e per l'uso reale:
 * - mediana mobile (robusta ai picchi GPS, a differenza della media)
 * - velocità derivata distanza/tempo quando il GPS non fornisce `speed`
 *   (iOS Safari restituisce spesso `coords.speed = null`)
 * - isteresi sulle soglie: niente sfarfallio piedi/bici/auto vicino ai confini
 * - cambio rapido su segnale forte, prudente su segnale borderline
 */

export type DetectorMode = "foot" | "bike" | "car";

export interface GeoFix {
  lat: number;
  lng: number;
  t: number; // ms epoch
  /** km/h — null quando il device non fornisce la velocità (tipico iOS) */
  speedKmh: number | null;
  accuracyM?: number | null;
}

/* Soglie con isteresi */
const STATIONARY_KMH = 1.2;
const ENTER_BIKE_KMH = 8;
const EXIT_BIKE_KMH = 6;
const ENTER_CAR_KMH = 42;
const EXIT_CAR_KMH = 32;

/* Fasce "forti": qui il segnale è inequivocabile, cambiamo in 2 sample */
const STRONG_BIKE_MIN = 12;
const STRONG_BIKE_MAX = 38;
const STRONG_CAR_KMH = 55;

const WINDOW = 6;
const STABLE_FAST = 2;
const STABLE_SLOW = 4;

/** Precisione oltre la quale il fix non influenza la classificazione */
export const CLASSIFY_MAX_ACCURACY_M = 80;

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Velocità effettiva di un fix: usa quella del GPS se presente e plausibile,
 * altrimenti la deriva da distanza/tempo rispetto al fix precedente.
 */
export function effectiveSpeedKmh(prev: GeoFix | null, cur: GeoFix): number {
  const gps = cur.speedKmh;
  if (gps != null && !Number.isNaN(gps) && gps >= 0) {
    // Sanity check: se il GPS dice "fermo" ma ci siamo spostati molto, deriva.
    if (gps < STATIONARY_KMH && prev) {
      const dtH = (cur.t - prev.t) / 3600000;
      if (dtH > 0) {
        const derived = haversineMeters(prev, cur) / 1000 / dtH;
        if (derived >= ENTER_BIKE_KMH && derived < 250) return derived;
      }
    }
    return gps;
  }
  if (!prev) return 0;
  const dtH = (cur.t - prev.t) / 3600000;
  if (dtH <= 0) return 0;
  // Gap lunghi (app in background) non sono movimento reale continuo:
  // oltre 20s senza fix la velocità derivata è poco affidabile → prudente.
  if (dtH > 20 / 3600) return 0;
  const derived = haversineMeters(prev, cur) / 1000 / dtH;
  return derived < 250 ? derived : 0;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Banda di appartenenza di una velocità (con isteresi rispetto al modo corrente). */
function bandFor(speed: number, current: DetectorMode): DetectorMode {
  if (speed < STATIONARY_KMH) return "foot";
  switch (current) {
    case "foot":
      if (speed >= ENTER_CAR_KMH) return "car";
      if (speed >= ENTER_BIKE_KMH) return "bike";
      return "foot";
    case "bike":
      if (speed >= ENTER_CAR_KMH) return "car";
      if (speed < EXIT_BIKE_KMH) return "foot";
      return "bike";
    case "car":
      if (speed < EXIT_BIKE_KMH) return "foot";
      if (speed < EXIT_CAR_KMH) return "bike";
      return "car";
  }
}

/**
 * Classificatore a stato: alimentalo con `push(speedKmh)` a ogni fix GPS,
 * legge il modo corrente da `.mode`. Reazione rapida ma stabile.
 */
export class ModeDetector {
  mode: DetectorMode = "foot";
  /** velocità lisciata (mediana mobile) in km/h */
  smoothedKmh = 0;
  private win: number[] = [];
  private candidate: DetectorMode = "foot";
  private candidateCount = 0;

  reset() {
    this.mode = "foot";
    this.smoothedKmh = 0;
    this.win = [];
    this.candidate = "foot";
    this.candidateCount = 0;
  }

  push(speedKmh: number): DetectorMode {
    const v = Math.max(0, speedKmh);
    this.win.push(v);
    if (this.win.length > WINDOW) this.win.shift();
    this.smoothedKmh = median(this.win);

    // Fermo: torna subito a piedi, niente attesa.
    if (this.smoothedKmh < STATIONARY_KMH) {
      this.mode = "foot";
      this.candidate = "foot";
      this.candidateCount = STABLE_SLOW;
      return this.mode;
    }

    const band = bandFor(this.smoothedKmh, this.mode);
    if (band === this.mode) {
      this.candidate = this.mode;
      this.candidateCount = 0;
      return this.mode;
    }

    if (band === this.candidate) {
      this.candidateCount += 1;
    } else {
      this.candidate = band;
      this.candidateCount = 1;
    }

    const strong =
      (band === "bike" &&
        this.smoothedKmh >= STRONG_BIKE_MIN &&
        this.smoothedKmh <= STRONG_BIKE_MAX) ||
      (band === "car" && this.smoothedKmh >= STRONG_CAR_KMH);
    const needed = strong ? STABLE_FAST : STABLE_SLOW;

    if (this.candidateCount >= needed) {
      this.mode = band;
      this.candidateCount = 0;
    }
    return this.mode;
  }
}

/**
 * Plausibilità server-side: limita il mezzo dichiarato alla velocità misurata
 * sul segmento. Anti-frode: un segmento "bici" a 60 km/h diventa auto.
 */
export function clampModeToSpeed(hint: DetectorMode, segSpeedKmh: number): DetectorMode {
  if (hint === "foot") {
    if (segSpeedKmh <= 14) return "foot";
    return segSpeedKmh <= 45 ? "bike" : "car";
  }
  if (hint === "bike") {
    return segSpeedKmh <= 50 ? "bike" : "car";
  }
  return "car";
}
