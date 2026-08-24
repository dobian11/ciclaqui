import type { TripMode } from "@/components/cicla/GoogleMapView";

export interface StoredTripPoint {
  lat: number;
  lng: number;
  t: number;
  s?: number; // km/h
  m?: TripMode; // mezzo classificato al momento del fix
}

export interface StoredTrip {
  startedAt: number;
  path: StoredTripPoint[];
  distanceKm: number;
  dominantMode: TripMode;
  modeCounts: Record<TripMode, number>;
  /** km percorsi per mezzo (somma dei segmenti) */
  distanceByMode?: Record<TripMode, number>;
  savedAt: number;
}

const KEY = "ciclaqui.activeTrip.v2";
const LEGACY_KEY = "ciclaqui.activeTrip.v1";
/** Oltre questa pausa il viaggio salvato è considerato scaduto e non viene ripreso. */
export const RESUME_MAX_GAP_MS = 30 * 60 * 1000;
/** Tetto punti persistiti: oltre si diradano i fix vecchi (localStorage ~5MB). */
export const MAX_STORED_POINTS = 4000;

export function saveActiveTrip(trip: StoredTrip) {
  if (typeof window === "undefined") return;
  try {
    let path = trip.path;
    if (path.length > MAX_STORED_POINTS) {
      // dirada la metà più vecchia tenendo i fix recenti a piena risoluzione
      const half = Math.floor(path.length / 2);
      const old = path.slice(0, half).filter((_, i) => i % 2 === 0);
      path = [...old, ...path.slice(half)];
    }
    window.localStorage.setItem(KEY, JSON.stringify({ ...trip, path, savedAt: Date.now() }));
  } catch {
    /* quota / private mode */
  }
}

export function loadActiveTrip(): StoredTrip | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY) ?? window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTrip;
    if (!parsed?.startedAt || !Array.isArray(parsed.path)) return null;
    if (Date.now() - (parsed.savedAt ?? parsed.startedAt) > RESUME_MAX_GAP_MS) {
      clearActiveTrip();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearActiveTrip() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

type WakeLockLike = { release: () => Promise<void>; released?: boolean };

/**
 * Wake Lock: impedisce lo spegnimento schermo mentre il viaggio è in corso,
 * così su web/PWA il watchPosition continua a ricevere fix anche in tasca.
 * Si ri-acquisisce automaticamente quando la pagina torna visibile.
 */
export function createWakeLockKeeper() {
  let sentinel: WakeLockLike | null = null;
  let enabled = false;

  const request = async () => {
    if (!enabled || typeof navigator === "undefined") return;
    const wl = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<WakeLockLike> } }).wakeLock;
    if (!wl) return;
    try {
      if (document.visibilityState !== "visible") return;
      sentinel = await wl.request("screen");
    } catch {
      /* negato o non supportato */
    }
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible") void request();
  };

  return {
    async acquire() {
      if (enabled) return;
      enabled = true;
      document.addEventListener("visibilitychange", onVisibility);
      await request();
    },
    async release() {
      enabled = false;
      document.removeEventListener("visibilitychange", onVisibility);
      try {
        await sentinel?.release();
      } catch {
        /* ignore */
      }
      sentinel = null;
    },
  };
}
