import { useEffect, useRef, useState } from "react";
import type { TripMode } from "@/components/cicla/MapView";
import {
  CLASSIFY_MAX_ACCURACY_M,
  ModeDetector,
  effectiveSpeedKmh,
  type GeoFix,
} from "@/lib/mode-detector";

export type GeoErrorCode = "denied" | "unavailable" | "timeout" | "unsupported" | "unknown";

export interface GeoError {
  code: GeoErrorCode;
  message: string;
}

export interface GeoState {
  position: [number, number] | null;
  speedKmh: number;
  mode: TripMode;
  accuracy: number | null;
  error: GeoError | null;
  loading: boolean;
  retry: () => void;
}

/**
 * Osserva la geolocalizzazione e ricava il mezzo di trasporto.
 *
 * Affidabilità (demo e uso reale):
 * - se il device non fornisce la velocità (iOS Safari: `coords.speed = null`)
 *   la deriva da distanza/tempo tra fix consecutivi — niente più "a piedi" fisso;
 * - mediana mobile + isteresi anti-sfarfallio (vedi mode-detector.ts);
 * - fix con precisione scarsa aggiornano la posizione ma non la classificazione.
 */
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

  const detectorRef = useRef<ModeDetector | null>(null);
  const lastFixRef = useRef<GeoFix | null>(null);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }
    const detector = (detectorRef.current = detectorRef.current ?? new ModeDetector());
    lastFixRef.current = null;
    setState((s) => ({ ...s, error: null, loading: true }));

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: GeoFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          t: pos.timestamp || Date.now(),
          speedKmh:
            pos.coords.speed != null && !Number.isNaN(pos.coords.speed)
              ? Math.max(0, pos.coords.speed * 3.6)
              : null,
          accuracyM: pos.coords.accuracy ?? null,
        };
        const accuracy = pos.coords.accuracy ?? null;
        const speed = effectiveSpeedKmh(lastFixRef.current, fix);
        lastFixRef.current = fix;

        // Classifica solo con fix affidabili; la posizione si aggiorna sempre.
        const reliable = accuracy == null || accuracy <= CLASSIFY_MAX_ACCURACY_M;
        const mode = (reliable ? detector.push(speed) : detector.mode) as TripMode;

        setState((s) => ({
          ...s,
          position: [fix.lat, fix.lng],
          speedKmh: reliable ? detector.smoothedKmh : s.speedKmh,
          mode,
          accuracy,
          error: null,
          loading: false,
        }));
      },
      (err) => {
        const code: GeoErrorCode =
          err.code === 1 ? "denied" : err.code === 2 ? "unavailable" : err.code === 3 ? "timeout" : "unknown";
        setState((s) => ({ ...s, error: { code, message: err.message }, loading: false }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 15000,
      },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, retryTick]);

  return state;
}
