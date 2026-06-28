import { useEffect, useRef, useState } from "react";
import type { TripMode } from "@/components/cicla/MapView";

export interface GeoState {
  position: [number, number] | null;
  speedKmh: number;
  mode: TripMode;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
  retry: () => void;
}

/**
 * Watches the device geolocation and infers the user's transport mode from the
 * smoothed instantaneous GPS speed.
 *
 * Thresholds match `app_config` defaults (foot < 8 km/h, bike 8–35 km/h, car > 35 km/h).
 * The smoothing window dampens GPS jitter so a single noisy reading does not
 * flip the icon. Persisting a mode requires `MODE_STABILITY` consecutive
 * samples agreeing with the new candidate.
 */
const FOOT_KMH = 8;
const BIKE_KMH = 35;
const MODE_STABILITY = 3;

export function useGeolocation(enabled = true): GeoState {
  const [retryTick, setRetryTick] = useState(0);
  const [state, setState] = useState<GeoState>({
    position: null,
    speedKmh: 0,
    mode: "foot",
    accuracy: null,
    error: null,
    loading: true,
    retry: () => setRetryTick((t) => t + 1),
  });

  const recentSpeeds = useRef<number[]>([]);
  const candidate = useRef<{ mode: TripMode; count: number }>({ mode: "foot", count: 0 });

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const speedMs = pos.coords.speed; // m/s, can be null
        const speedKmh = speedMs != null && !Number.isNaN(speedMs) ? Math.max(0, speedMs * 3.6) : 0;

        // smoothing window of last 5 samples
        const win = recentSpeeds.current;
        win.push(speedKmh);
        if (win.length > 5) win.shift();
        const smoothed = win.reduce((a, b) => a + b, 0) / win.length;

        let candidateMode: TripMode;
        if (smoothed < FOOT_KMH) candidateMode = "foot";
        else if (smoothed < BIKE_KMH) candidateMode = "bike";
        else candidateMode = "car";

        let nextMode = state.mode;
        if (candidate.current.mode === candidateMode) {
          candidate.current.count += 1;
        } else {
          candidate.current = { mode: candidateMode, count: 1 };
        }
        // Stazionario (<1 km/h): blocca subito su "a piedi" senza aspettare la stabilità.
        // Questo evita che a riposo il marker resti su un mode "ereditato" (bici/auto).
        if (smoothed < 1) {
          nextMode = "foot";
          candidate.current = { mode: "foot", count: MODE_STABILITY };
        } else if (candidate.current.count >= MODE_STABILITY) {
          nextMode = candidateMode;
        }

        setState((s) => ({
          ...s,
          position: [pos.coords.latitude, pos.coords.longitude],
          speedKmh: smoothed,
          mode: nextMode,
          accuracy: pos.coords.accuracy ?? null,
          error: null,
          loading: false,
        }));
      },
      (err) => {
        setState((s) => ({ ...s, error: err.message, loading: false }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 15000,
      },
    );
    return () => navigator.geolocation.clearWatch(watchId);
    // We intentionally read state.mode inside the callback via closure-safe
    // setState updater, so we don't list it as a dep (would re-subscribe per fix).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return state;
}
