/**
 * Raccolta motion/heading del device per sensor-fusion nel rilevamento mezzo.
 *
 * - DeviceMotionEvent fornisce accelerazione (con/senza gravità) e rotazione.
 * - DeviceOrientationEvent fornisce alpha/beta/gamma; usiamo alpha come heading
 *   approssimativo per calcolare la stabilità di direzione tra fix GPS.
 *
 * Il tutto è opt-in e graceful: se i sensori non ci sono o i permessi iOS
 * vengono rifiutati, il classificatore torna a GPS-only senza bloccare l'app.
 */

export interface MotionSample {
  /** Varianza dell'accelerazione (m/s²) — alta = movimento irregolare (piedi), media = bici, bassa = auto */
  accelVariance: number;
  /** Variazione heading in gradi tra due campioni consecutivi — bassa = auto, media = bici, alta = piedi */
  headingDeltaDeg: number;
  /** Timestamp ms */
  t: number;
}

interface Accumulator {
  samples: MotionSample[];
  lastHeading: number | null;
  accelReadings: number[];
  startT: number;
}

let acc: Accumulator | null = null;
let listenersAttached = false;

function resetAccumulator() {
  acc = {
    samples: [],
    lastHeading: null,
    accelReadings: [],
    startT: Date.now(),
  };
}

function pushAccel(a: number) {
  if (!acc) return;
  acc.accelReadings.push(a);
  // finestra scorrevole per non far esplodere la memoria in background
  if (acc.accelReadings.length > 120) acc.accelReadings.shift();
}

function pushHeading(headingDeg: number | null) {
  if (!acc || headingDeg == null) return;
  let delta = 0;
  if (acc.lastHeading != null) {
    delta = Math.abs(((headingDeg - acc.lastHeading + 540) % 360) - 180);
  }
  acc.lastHeading = headingDeg;

  const variance = varianceOf(acc.accelReadings);
  acc.samples.push({
    accelVariance: variance,
    headingDeltaDeg: delta,
    t: Date.now(),
  });
  if (acc.samples.length > 60) acc.samples.shift();
}

function varianceOf(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const sq = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return sq;
}

function onMotion(e: DeviceMotionEvent) {
  // Preferiamo acceleration (senza gravità) quando disponibile; fallback su accelerationIncludingGravity
  const a = e.acceleration?.x ?? e.accelerationIncludingGravity?.x ?? 0;
  const b = e.acceleration?.y ?? e.accelerationIncludingGravity?.y ?? 0;
  const c = e.acceleration?.z ?? e.accelerationIncludingGravity?.z ?? 0;
  const mag = Math.sqrt(a * a + b * b + c * c);
  pushAccel(mag);
}

function onOrientation(e: DeviceOrientationEvent) {
  // alpha è la bussola in gradi; su iOS può richiedere il permesso.
  if (e.alpha != null) pushHeading(e.alpha);
}

/**
 * Richiede i permessi su iOS 13+ per DeviceOrientation/Motion.
 * Su Android e desktop solitamente non serve.
 */
async function requestIOSPermission(): Promise<boolean> {
  const anyNav = navigator as any;
  if (typeof anyNav?.permissions?.query === "function") {
    try {
      const result = await anyNav.permissions.query({ name: "device-orientation" });
      if (result.state === "denied") return false;
    } catch {
      // query non supportata per questo nome → continua
    }
  }
  if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
    try {
      const res = await (DeviceOrientationEvent as any).requestPermission();
      if (res !== "granted") return false;
    } catch {
      return false;
    }
  }
  if (typeof (DeviceMotionEvent as any).requestPermission === "function") {
    try {
      const res = await (DeviceMotionEvent as any).requestPermission();
      if (res !== "granted") return false;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Avvia la raccolta motion. Ritorna true se i listener sono attivi.
 */
export async function startMotionCollection(): Promise<boolean> {
  if (listenersAttached) return true;
  if (typeof window === "undefined") return false;

  const ok = await requestIOSPermission();
  if (!ok) return false;

  resetAccumulator();
  window.addEventListener("devicemotion", onMotion, { passive: true });
  window.addEventListener("deviceorientation", onOrientation, { passive: true });
  listenersAttached = true;
  return true;
}

/**
 * Ferma la raccolta e rilascia i listener.
 */
export function stopMotionCollection() {
  if (!listenersAttached) return;
  window.removeEventListener("devicemotion", onMotion);
  window.removeEventListener("deviceorientation", onOrientation);
  listenersAttached = false;
  acc = null;
}

/**
 * Restituisce i campioni motion raccolti dall'ultima chiamata e svuota il buffer.
 * Il chiamante (trip recorder) usa questi campioni per classificare ogni fix GPS.
 */
export function flushMotionSamples(): MotionSample[] {
  if (!acc) return [];
  const out = acc.samples.slice();
  acc.samples = [];
  return out;
}

/**
 * Aggrega i campioni in un singolo Sample per il classificatore.
 * Se non ci sono campioni, torna valori neutrali (classificatore GPS-only).
 */
export function aggregateMotionSamples(samples: MotionSample[]): {
  accelVariance: number;
  headingDeltaDeg: number;
} {
  if (!samples.length) return { accelVariance: 0, headingDeltaDeg: 0 };
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  return {
    accelVariance: avg(samples.map((s) => s.accelVariance)),
    headingDeltaDeg: avg(samples.map((s) => s.headingDeltaDeg)),
  };
}
