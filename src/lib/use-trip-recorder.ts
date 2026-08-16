import { useCallback, useEffect, useRef, useState } from "react";
import type { TripMode } from "@/components/cicla/GoogleMapView";
import {
  clearActiveTrip,
  createWakeLockKeeper,
  loadActiveTrip,
  saveActiveTrip,
} from "@/lib/trip-persistence";

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
  const wakeLockRef = useRef<ReturnType<typeof createWakeLockKeeper> | null>(null);
  const stateRef = useRef<TripRecorderState | null>(null);
  const modeCountsRef = useRef<Record<TripMode, number>>({ foot: 0, bike: 0, car: 0 });
  const modeAtFixRef = useRef<TripMode>(currentMode);

  // tieni traccia del mode "vivo"
  useEffect(() => {
    modeAtFixRef.current = currentMode;
  }, [currentMode]);

  const armWatch = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
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
          if (!prev.recording) return prev;
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
  }, []);

  const armTicker = useCallback(() => {
    if (tickRef.current != null) clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      setState((prev) =>
        prev.recording && prev.startedAt
          ? { ...prev, durationS: Math.round((Date.now() - prev.startedAt) / 1000) }
          : prev,
      );
    }, 1000);
  }, []);

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
    armWatch();
    armTicker();
    wakeLockRef.current = wakeLockRef.current ?? createWakeLockKeeper();
    void wakeLockRef.current.acquire();
  }, [currentMode, armWatch, armTicker]);

  const stop = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (tickRef.current != null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    void wakeLockRef.current?.release();
    clearActiveTrip();
    setState((prev) => ({ ...prev, recording: false }));
  }, []);

  const reset = useCallback(() => {
    clearActiveTrip();
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

  // Persistenza continua: se il browser sospende/chiude la pagina il viaggio
  // non va perso e viene ripreso alla riapertura.
  useEffect(() => {
    stateRef.current = state;
    if (state.recording && state.startedAt) {
      saveActiveTrip({
        startedAt: state.startedAt,
        path: state.path,
        distanceKm: state.distanceKm,
        dominantMode: state.dominantMode,
        modeCounts: modeCountsRef.current,
        savedAt: Date.now(),
      });
    }
  }, [state]);

  // Ripresa automatica all'avvio (reload, tab sospesa, PWA riaperta).
  useEffect(() => {
    const stored = loadActiveTrip();
    if (!stored) return;
    modeCountsRef.current = stored.modeCounts ?? { foot: 0, bike: 0, car: 0 };
    setState({
      recording: true,
      startedAt: stored.startedAt,
      path: stored.path,
      distanceKm: stored.distanceKm,
      durationS: Math.round((Date.now() - stored.startedAt) / 1000),
      dominantMode: stored.dominantMode,
    });
    armWatch();
    armTicker();
    wakeLockRef.current = wakeLockRef.current ?? createWakeLockKeeper();
    void wakeLockRef.current.acquire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Il watch GPS può essere ucciso dal browser in background: lo riarmiamo
  // appena la pagina torna visibile o viene ripristinata dalla bfcache.
  useEffect(() => {
    const revive = () => {
      if (!stateRef.current?.recording) return;
      if (document.visibilityState !== "visible") return;
      armWatch();
      armTicker();
      void wakeLockRef.current?.acquire();
    };
    document.addEventListener("visibilitychange", revive);
    window.addEventListener("pageshow", revive);
    window.addEventListener("focus", revive);
    return () => {
      document.removeEventListener("visibilitychange", revive);
      window.removeEventListener("pageshow", revive);
      window.removeEventListener("focus", revive);
    };
  }, [armWatch, armTicker]);

  return { ...state, start, stop, reset };
}
