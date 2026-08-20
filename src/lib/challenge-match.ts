/** Quali coppe/maratone avanzano con il viaggio in corso, in base al mezzo rilevato. */
export type ChallengeLike = {
  id: string;
  title: string;
  icon?: string | null;
  type: string;
  goal: number | string;
  is_team?: boolean | null;
  trophy_label?: string | null;
  progress?: number;
  team_progress?: number;
};

export function challengeMatchesMode(type: string, mode: "bike" | "foot" | "car") {
  if (mode === "car") return false;
  if (type === "km_bike") return mode === "bike";
  if (type === "km_foot") return mode === "foot";
  // trip_count, streak_days, co2_saved avanzano con qualunque spostamento green
  return ["trip_count", "streak_days", "co2_saved"].includes(type);
}

/** Incremento stimato che questo viaggio porta alla coppa. */
export function estimateDelta(type: string, distanceKm: number) {
  if (type === "km_bike" || type === "km_foot") return distanceKm;
  if (type === "trip_count") return 1;
  if (type === "co2_saved") return distanceKm * 0.192;
  return 0;
}

export function challengeUnit(type: string) {
  if (type === "trip_count") return "viaggi";
  if (type === "streak_days") return "giorni";
  if (type === "co2_saved") return "kg CO₂";
  return "km";
}
