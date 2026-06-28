import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Wrapper unificato: usa Capacitor BackgroundGeolocation in nativo (iOS/Android),
 * fallback a Geolocation API standard sul web (PWA).
 * L'import di Capacitor è dinamico per non rompere il bundle web.
 */

type Pt = { lat: number; lng: number; t: number; speedKmh: number };

export function useBackgroundTrip() {
  const [active, setActive] = useState(false);
  const [points, setPoints] = useState<Pt[]>([]);
  const watcherIdRef = useRef<number | string | null>(null);
  const nativeRef = useRef<{ remove?: () => Promise<void> } | null>(null);

  const isNative = (() => {
    try {
      // accesso a finestra/capacitor solo client
      return typeof window !== "undefined" && (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;
    } catch { return false; }
  })();

  const start = useCallback(async () => {
    if (active) return;
    setPoints([]);
    if (isNative) {
      try {
        const mod = await import(/* @vite-ignore */ "@capacitor-community/background-geolocation");
        const BackgroundGeolocation = (mod as { default?: unknown }).default ?? mod;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const id = await (BackgroundGeolocation as any).addWatcher(
          {
            backgroundMessage: "Cicla Qui sta registrando il tuo viaggio",
            backgroundTitle: "Tracking attivo",
            requestPermissions: true,
            stale: false,
            distanceFilter: 10,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (location: any, error: unknown) => {
            if (error) { console.error(error); return; }
            const p: Pt = {
              lat: location.latitude,
              lng: location.longitude,
              t: Date.now(),
              speedKmh: Math.max(0, (location.speed ?? 0) * 3.6),
            };
            setPoints((prev) => [...prev, p]);
          }
        );
        watcherIdRef.current = id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nativeRef.current = { remove: () => (BackgroundGeolocation as any).removeWatcher({ id }) };
        setActive(true);
        return;
      } catch (e) {
        console.warn("Capacitor BG geo non disponibile, fallback web", e);
      }
    }
    // Fallback web
    if (!("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPoints((prev) => [...prev, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          t: Date.now(),
          speedKmh: Math.max(0, (pos.coords.speed ?? 0) * 3.6),
        }]);
      },
      (err) => console.warn(err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
    watcherIdRef.current = id;
    setActive(true);
  }, [active, isNative]);

  const stop = useCallback(async () => {
    if (!active) return;
    if (nativeRef.current?.remove) {
      try { await nativeRef.current.remove(); } catch { /* ignore */ }
      nativeRef.current = null;
    } else if (typeof watcherIdRef.current === "number") {
      navigator.geolocation.clearWatch(watcherIdRef.current);
    }
    watcherIdRef.current = null;
    setActive(false);
  }, [active]);

  useEffect(() => () => { void stop(); }, [stop]);

  return { active, points, start, stop, isNative };
}
