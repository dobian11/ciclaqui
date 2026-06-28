import { useCallback, useEffect, useRef, useState } from "react";
import type { TripMode } from "@/components/cicla/GoogleMapView";

export interface TripPoint {
  lat: number;
  lng: number;
  t: number; // ms epoch
  s?: number; // km/h
}

export interface TripRecorderState {
  recording: boolean;
  startedAt: number | null;
  path: TripPoint[];
  distanceKm: number;
  durationS: number;
  dominantMode: TripMode;
}

function haversineKm(a: TripPoint, b: TripPoint) {
  const R = 6371;
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
 * Registratore viaggio: accumula i fix GPS dal momento di Start fino a Stop,
 * calcola distanza e modalità dominante. La scrittura punti avviene lato server
 * con endTrip per impedire frodi client-side.
 */
export function useTripRecorder(currentMode: TripMode) {
  const [state, setState] = useState<TripRecorderState>({
    recording: false,
    startedAt: null,
    path: [],
    distanceKm: 0,
    durationS: 0,
    dominantMode: "foot",
  });

  const watchIdRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const modeCountsRef = useRef<Record<TripMode, number>>({ foot: 0, bike: 0, car: 0 });
  const modeAtFixRef = useRef<TripMode>(currentMode);

  // tieni traccia del mode "vivo"
  useEffect(() => {
    modeAtFixRef.current = currentMode;
  }, [currentMode]);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    modeCountsRef.current = { foot: 0, bike: 0, car: 0 };
    const startedAt = Date.now();
    setState({
      recording: true,
      startedAt,
      path: [],
      distanceKm: 0,
      durationS: 0,
      dominantMode: currentMode,
    });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = pos.coords.accuracy ?? 999;
        if (acc > 50) return; // scarta fix poco precisi
        const point: TripPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          t: Date.now(),
          s: pos.coords.speed != null ? Math.max(0, pos.coords.speed * 3.6) : undefined,
        };
        modeCountsRef.current[modeAtFixRef.current] += 1;
        setState((prev) => {
          const last = prev.path[prev.path.length - 1];
          let dist = prev.distanceKm;
          if (last) {
            const d = haversineKm(last, point);
            if (d < 1) dist += d; // ignora salti > 1km tra fix
          }
          const dominant = (Object.entries(modeCountsRef.current).sort(
            (a, b) => b[1] - a[1],
          )[0]?.[0] ?? "foot") as TripMode;
          return {
            ...prev,
            path: [...prev.path, point],
            distanceKm: dist,
            dominantMode: dominant,
          };
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );

    tickRef.current = window.setInterval(() => {
      setState((prev) =>
        prev.recording && prev.startedAt
          ? { ...prev, durationS: Math.round((Date.now() - prev.startedAt) / 1000) }
          : prev,
      );
    }, 1000);
  }, [currentMode]);

  const stop = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (tickRef.current != null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setState((prev) => ({ ...prev, recording: false }));
  }, []);

  const reset = useCallback(() => {
    setState({
      recording: false,
      startedAt: null,
      path: [],
      distanceKm: 0,
      durationS: 0,
      dominantMode: "foot",
    });
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (tickRef.current != null) clearInterval(tickRef.current);
    };
  }, []);

  return { ...state, start, stop, reset };
}
