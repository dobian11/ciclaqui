/**
 * Anti-frode livello 4: combina velocità GPS + variance accelerometro + stabilità heading
 * per stimare il mezzo di trasporto con uno score di confidenza 0..1.
 */
export type Mode = "foot" | "bike" | "car";
export type Sample = { speedKmh: number; accelVariance: number; headingDeltaDeg: number };

export function classifySample(s: Sample): { mode: Mode; confidence: number } {
  const v = s.speedKmh;
  const av = s.accelVariance;
  const hd = s.headingDeltaDeg;

  let foot = 0, bike = 0, car = 0;
  // Speed
  if (v < 7) foot += 0.5;
  else if (v < 30) bike += 0.5;
  else car += 0.5;
  // Accel variance (auto = bassa, bici = media, piedi = alta)
  if (av < 0.5) car += 0.25;
  else if (av < 2.0) bike += 0.25;
  else foot += 0.25;
  // Heading stability
  if (hd < 5) car += 0.25;
  else if (hd < 20) bike += 0.25;
  else foot += 0.25;

  const winner: Mode = bike >= foot && bike >= car ? "bike" : foot >= car ? "foot" : "car";
  const confidence = Math.min(1, Math.max(foot, bike, car));
  return { mode: winner, confidence };
}

export function classifyTrip(samples: Sample[]): { mode: Mode; confidence: number; score: number } {
  if (!samples.length) return { mode: "foot", confidence: 0, score: 0 };
  const tally = { foot: 0, bike: 0, car: 0 };
  let sumConf = 0;
  for (const s of samples) {
    const { mode, confidence } = classifySample(s);
    tally[mode] += confidence;
    sumConf += confidence;
  }
  const total = tally.foot + tally.bike + tally.car || 1;
  const mode: Mode = tally.bike >= tally.foot && tally.bike >= tally.car ? "bike" : tally.foot >= tally.car ? "foot" : "car";
  const confidence = tally[mode] / total;
  return { mode, confidence, score: sumConf / samples.length };
}

export const FLAG_THRESHOLD = 0.55;
