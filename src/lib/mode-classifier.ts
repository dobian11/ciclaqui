/**
 * Anti-frode livello 4: combina velocità GPS + varianza accelerometro + stabilità heading
 * per stimare il mezzo di trasporto con uno score di confidenza 0..1.
 *
 * Questo modulo è usato in due momenti:
 * 1) Classificazione in streaming nel trip recorder (sensor-fusion).
 * 2) Validazione server-side di campioni inviati dal client.
 *
 * Il bias "bike boost" garantisce che, a parità di evidenze ambigue in fascia
 * ciclismo (8–30 km/h), il mezzo venga classificato come bici — requisito
 * esplicito del prodotto: "per bici deve essere verde per forza".
 */
export type Mode = "foot" | "bike" | "car";
export type Sample = { speedKmh: number; accelVariance: number; headingDeltaDeg: number };

/** Soglia di confidenza sotto cui il classificatore segnala un campione incerto. */
export const FLAG_THRESHOLD = 0.55;

interface Weights {
  speed: number;
  accel: number;
  heading: number;
  bikeBoost: number;
}

const DEFAULT_WEIGHTS: Weights = {
  speed: 0.5,
  accel: 0.25,
  heading: 0.25,
  bikeBoost: 0.12,
};

function scoreSpeed(v: number): Record<Mode, number> {
  if (v < 1.2) return { foot: 0.9, bike: 0.05, car: 0.05 };
  if (v < 7) return { foot: 0.7, bike: 0.25, car: 0.05 };
  if (v < 12) return { foot: 0.25, bike: 0.65, car: 0.1 };
  if (v < 28) return { foot: 0.05, bike: 0.85, car: 0.1 }; // fascia ciclismo preferita
  if (v < 40) return { foot: 0, bike: 0.45, car: 0.55 };
  if (v < 60) return { foot: 0, bike: 0.15, car: 0.85 };
  return { foot: 0, bike: 0.05, car: 0.95 };
}

function scoreAccel(av: number): Record<Mode, number> {
  // auto = bassa varianza, bici = media, piedi = alta
  if (av < 0.4) return { foot: 0.1, bike: 0.3, car: 0.9 };
  if (av < 1.5) return { foot: 0.25, bike: 0.7, car: 0.35 };
  if (av < 4.0) return { foot: 0.55, bike: 0.35, car: 0.1 };
  return { foot: 0.85, bike: 0.1, car: 0.05 };
}

function scoreHeading(hd: number): Record<Mode, number> {
  // auto = heading stabile, bici = variazioni moderate, piedi = molto irregolare
  if (hd < 4) return { foot: 0.1, bike: 0.3, car: 0.9 };
  if (hd < 15) return { foot: 0.3, bike: 0.7, car: 0.3 };
  if (hd < 35) return { foot: 0.6, bike: 0.35, car: 0.05 };
  return { foot: 0.85, bike: 0.1, car: 0.05 };
}

function normalizeScores(s: Record<Mode, number>): Record<Mode, number> {
  const total = s.foot + s.bike + s.car;
  if (total <= 0) return { foot: 0.33, bike: 0.33, car: 0.34 };
  return { foot: s.foot / total, bike: s.bike / total, car: s.car / total };
}

/**
 * Classifica un singolo campione con sensor-fusion.
 * Se accelVariance e headingDeltaDeg sono 0 (sensori assenti), pesa solo la velocità.
 */
export function classifySample(
  s: Sample,
  weights: Weights = DEFAULT_WEIGHTS,
): { mode: Mode; confidence: number; scores: Record<Mode, number> } {
  const v = Math.max(0, s.speedKmh);
  const av = Math.max(0, s.accelVariance);
  const hd = Math.max(0, s.headingDeltaDeg);

  const speedScores = scoreSpeed(v);
  const accelScores = scoreAccel(av);
  const headingScores = scoreHeading(hd);

  const raw: Record<Mode, number> = {
    foot:
      speedScores.foot * weights.speed +
      accelScores.foot * weights.accel +
      headingScores.foot * weights.heading,
    bike:
      speedScores.bike * weights.speed +
      accelScores.bike * weights.accel +
      headingScores.bike * weights.heading,
    car:
      speedScores.car * weights.speed +
      accelScores.car * weights.accel +
      headingScores.car * weights.heading,
  };

  // Bike boost: in fascia ciclismo (8–35 km/h) aumenta il punteggio bici.
  if (v >= 8 && v <= 35) {
    raw.bike += weights.bikeBoost;
  }

  const scores = normalizeScores(raw);
  const winner: Mode = scores.bike >= scores.foot && scores.bike >= scores.car
    ? "bike"
    : scores.foot >= scores.car
      ? "foot"
      : "car";
  const confidence = scores[winner];
  return { mode: winner, confidence, scores };
}

/**
 * Classificatore a finestra scorrevole: aggrega N campioni per ridurre il rumore
 * e restituisce il mezzo dominante con confidenza media.
 */
export function classifyWindow(
  samples: Sample[],
  weights: Weights = DEFAULT_WEIGHTS,
): { mode: Mode; confidence: number; score: number } {
  if (!samples.length) return { mode: "foot", confidence: 0, score: 0 };

  const tally = { foot: 0, bike: 0, car: 0 };
  let sumConf = 0;
  for (const s of samples) {
    const { mode, confidence } = classifySample(s, weights);
    tally[mode] += confidence;
    sumConf += confidence;
  }
  const total = tally.foot + tally.bike + tally.car || 1;
  const mode: Mode = tally.bike >= tally.foot && tally.bike >= tally.car
    ? "bike"
    : tally.foot >= tally.car
      ? "foot"
      : "car";
  const confidence = tally[mode] / total;
  return { mode, confidence, score: sumConf / samples.length };
}

/**
 * Alias legacy per compatibilità con codice esistente.
 */
export function classifyTrip(
  samples: Sample[],
  weights?: Weights,
): { mode: Mode; confidence: number; score: number } {
  return classifyWindow(samples, weights);
}

/**
 * Helper per validazione server-side: dato un mezzo dichiarato e la velocità
 * misurata sul segmento, restituisce il mezzo plausibile.
 */
export function clampModeToSpeed(hint: Mode, segSpeedKmh: number): Mode {
  if (hint === "foot") {
    if (segSpeedKmh <= 14) return "foot";
    return segSpeedKmh <= 45 ? "bike" : "car";
  }
  if (hint === "bike") {
    return segSpeedKmh <= 45 ? "bike" : "car";
  }
  return "car";
}

/**
 * Classificatore streaming: accumula i campioni in una finestra e produce il
 * modo corrente ad ogni push. Usato nel trip recorder per sensor-fusion.
 */
export class StreamingModeClassifier {
  mode: Mode = "foot";
  confidence = 0;
  private window: Sample[] = [];
  private readonly maxWindow: number;

  constructor(maxWindow = 8) {
    this.maxWindow = maxWindow;
  }

  reset() {
    this.mode = "foot";
    this.confidence = 0;
    this.window = [];
  }

  push(sample: Sample): Mode {
    this.window.push(sample);
    if (this.window.length > this.maxWindow) this.window.shift();
    const res = classifyWindow(this.window);
    this.mode = res.mode;
    this.confidence = res.confidence;
    return this.mode;
  }
}
