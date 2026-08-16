import type { TripMode } from "@/components/cicla/GoogleMapView";

export interface StoredTripPoint {
  lat: number;
  lng: number;
  t: number;
  s?: number;
}

export interface StoredTrip {
  startedAt: number;
  path: StoredTripPoint[];
  distanceKm: number;
  dominantMode: TripMode;
  modeCounts: Record<TripMode, number>;
  savedAt: number;
}

const KEY = "ciclaqui.activeTrip.v1";
/** Oltre questa pausa il viaggio salvato è considerato scaduto e non viene ripreso. */
export const RESUME_MAX_GAP_MS = 30 * 60 * 1000;

export function saveActiveTrip(trip: StoredTrip) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...trip, savedAt: Date.now() }));
  } catch {
    /* quota / private mode */
  }
}

export function loadActiveTrip(): StoredTrip | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
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
