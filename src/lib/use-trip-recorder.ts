import { useCallback, useEffect, useRef, useState } from "react";
import type { TripMode } from "@/components/cicla/GoogleMapView";
import {
  clearActiveTrip,
  createWakeLockKeeper,
  loadActiveTrip,
  saveActiveTrip,
} from "@/lib/trip-persistence";
import {
  CLASSIFY_MAX_ACCURACY_M,
  ModeDetector,
  effectiveSpeedKmh,
  haversineMeters,
  type GeoFix,
} from "@/lib/mode-detector";
import {
  StreamingModeClassifier,
  FLAG_THRESHOLD,
  type Mode as ClassifierMode,
  type Sample as ClassifierSample,
} from "@/lib/mode-classifier";
import {
  aggregateMotionSamples,
  flushMotionSamples,
  startMotionCollection,
  stopMotionCollection,
} from "@/lib/motion-sensor";

export interface TripPoint {
  lat: number;
  lng: number;
  t: number; // ms epoch
  s?: number; // km/h
  m?: TripMode; // mezzo classificato al fix
}

export interface TripRecorderState {
  recording: boolean;
  startedAt: number | null;
  path: TripPoint[];
  distanceKm: number;
  durationS: number;
  dominantMode: TripMode;
  /** km percorsi per mezzo (per riepilogo e punti per segmento) */
  distanceByMode: Record<TripMode, number>;
  /** true su app nativa: il tracking continua anche ad app in background */
  nativeBackground: boolean;
  /** secondi totali in cui il sistema ha sospeso l'app (schermo spento su web/PWA) */
  suspendedGapS: number;
  /** timestamp dell'ultima interruzione rilevata (per avvisare l'utente) */
  lastGapAt: number | null;
}

const EMPTY_DBM: Record<TripMode, number> = { foot: 0, bike: 0, car: 0 };
/** Nessun fix per così tanto → il watch web è stato ucciso: riarmalo. */
const WATCHDOG_STALE_MS = 15_000;
/** Oltre questo silenzio consideriamo l'app sospesa dal sistema (schermo spento). */
const SUSPEND_GAP_MS = 25_000;


function isNativePlatform(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
        ?.isNativePlatform?.() === true
    );
  } catch {
    return false;
  }
}

interface NativeWatcher {
  remove: () => Promise<void>;
}

/**
 * Registratore viaggio: accumula i fix GPS dal momento di Start fino a Stop.
 *
 * Affidabilità:
 * - su app nativa usa @capacitor-community/background-geolocation: il tracking
 *   continua davvero con schermo spento / app in background (notifica persistente);
 * - su web/PWA: watchPosition + Wake Lock + watchdog che riarma il watch se il
 *   browser lo uccide in background;
 * - ogni fix è classificato (piedi/bici/auto) con isteresi anti-sfarfallio e
 *   velocità derivata quando il GPS non la fornisce (iOS);
 * - persistenza continua su localStorage: reload/chiusura non perdono il viaggio.
 *
 * La scrittura definitiva avviene lato server con endTrip (anti-frode).
 */
export function useTripRecorder(currentMode: TripMode) {
  const [state, setState] = useState<TripRecorderState>({
    recording: false,
    startedAt: null,
    path: [],
    distanceKm: 0,
    durationS: 0,
    dominantMode: "foot",
    distanceByMode: EMPTY_DBM,
    nativeBackground: false,
    suspendedGapS: 0,
    lastGapAt: null,
  });

  const watchIdRef = useRef<number | null>(null);
  const nativeWatcherRef = useRef<NativeWatcher | null>(null);
  const tickRef = useRef<number | null>(null);
  const watchdogRef = useRef<number | null>(null);
  const wakeLockRef = useRef<ReturnType<typeof createWakeLockKeeper> | null>(null);
  const stateRef = useRef<TripRecorderState | null>(null);
  const modeAtFixRef = useRef<TripMode>(currentMode);
  const detectorRef = useRef(new ModeDetector());
  const classifierRef = useRef(new StreamingModeClassifier());
  const motionStartedRef = useRef(false);
  const lastFixRef = useRef<GeoFix | null>(null);
  const lastFixAtRef = useRef<number>(0);
  const dbmRef = useRef<Record<TripMode, number>>({ ...EMPTY_DBM });
  /** true quando l'app è stata sospesa: il fix successivo non deve creare un salto. */
  const gapPendingRef = useRef(false);

  /** Registra una sospensione del sistema (schermo spento su web/PWA). */
  const noteSuspension = useCallback((gapMs: number) => {
    if (gapMs < SUSPEND_GAP_MS) return;
    gapPendingRef.current = true;
    lastFixRef.current = null;
    detectorRef.current.reset();
    classifierRef.current.reset();
    setState((prev) =>
      prev.recording
        ? {
            ...prev,
            suspendedGapS: prev.suspendedGapS + Math.round(gapMs / 1000),
            lastGapAt: Date.now(),
          }
        : prev,
    );
  }, []);


  // tieni traccia del mode "vivo" (fallback se il fix non è classificabile)
  useEffect(() => {
    modeAtFixRef.current = currentMode;
  }, [currentMode]);

  const ingestFix = useCallback((fix: GeoFix) => {
    const accuracy = fix.accuracyM ?? null;
    if (accuracy != null && accuracy > 50) return; // scarta fix poco precisi

    // Silenzio lungo tra due fix = app sospesa dal sistema (schermo spento su
    // web/PWA): non possiamo inventare il tratto mancante, lo marchiamo come buco.
    if (lastFixAtRef.current > 0 && Date.now() - lastFixAtRef.current > SUSPEND_GAP_MS) {
      noteSuspension(Date.now() - lastFixAtRef.current);
    }

    const speed = effectiveSpeedKmh(lastFixRef.current, fix);
    const reliable = accuracy == null || accuracy <= CLASSIFY_MAX_ACCURACY_M;


    // Sensor-fusion: se i motion sensor sono attivi e abbiamo campioni recenti,
    // usiamo il classificatore avanzato; altrimenti fallback sul GPS-only detector.
    let mode: TripMode = reliable ? detectorRef.current.push(speed) : modeAtFixRef.current;
    if (reliable && motionStartedRef.current) {
      const motion = aggregateMotionSamples(flushMotionSamples());
      const sample: ClassifierSample = {
        speedKmh: speed,
        accelVariance: motion.accelVariance,
        headingDeltaDeg: motion.headingDeltaDeg,
      };
      const fused = classifierRef.current.push(sample);
      // Se il classificatore fusion ha bassa confidenza, rimaniamo sul detector GPS-only
      // per evitare salti spuri; altrimenti usiamo il fused (con bike boost).
      if (classifierRef.current.confidence >= FLAG_THRESHOLD) {
        mode = fused as TripMode;
      }
    }

    lastFixRef.current = fix;
    lastFixAtRef.current = Date.now();

    const point: TripPoint = {
      lat: fix.lat,
      lng: fix.lng,
      t: fix.t,
      s: speed > 0 ? Math.round(speed * 10) / 10 : undefined,
      m: mode,
    };

    const skipSegment = gapPendingRef.current;
    gapPendingRef.current = false;

    setState((prev) => {
      if (!prev.recording) return prev;
      const last = prev.path[prev.path.length - 1];
      let dist = prev.distanceKm;
      if (last && !skipSegment) {
        const dM = haversineMeters(last, point);
        const dKm = dM / 1000;
        if (dKm < 1) {
          // ignora salti > 1km tra fix
          dist += dKm;
          dbmRef.current[mode] += dKm;
        }
      }
      // modo dominante = mezzo con più km (non più fix): giusto per viaggi misti
      const dominant = (Object.entries(dbmRef.current).sort((a, b) => b[1] - a[1])[0]?.[1] ?? 0) > 0
        ? (Object.entries(dbmRef.current).sort((a, b) => b[1] - a[1])[0][0] as TripMode)
        : mode;
      return {
        ...prev,
        path: [...prev.path, point],
        distanceKm: dist,
        dominantMode: dominant,
        distanceByMode: { ...dbmRef.current },
      };
    });
  }, [noteSuspension]);


  /** Watch web (PWA/browser). Su iOS Safari può morire in background: il watchdog lo riarma. */
  const armWebWatch = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    if (nativeWatcherRef.current) return; // nativo attivo: niente doppio watch
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        ingestFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          t: pos.timestamp || Date.now(),
          speedKmh:
            pos.coords.speed != null && !Number.isNaN(pos.coords.speed)
              ? Math.max(0, pos.coords.speed * 3.6)
              : null,
          accuracyM: pos.coords.accuracy ?? null,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
  }, [ingestFix]);

  /** Watch nativo: vero tracking in background su iOS/Android. */
  const armNativeWatch = useCallback(async (): Promise<boolean> => {
    if (!isNativePlatform()) return false;
    try {
      // Il pacchetto non ha entry point JS (solo codice nativo iOS/Android):
      // il plugin si raggiunge dal bridge Capacitor, presente solo nel build nativo.
      const BackgroundGeolocation = (
        window as unknown as {
          Capacitor?: { Plugins?: Record<string, any> };
        }
      ).Capacitor?.Plugins?.BackgroundGeolocation;
      if (!BackgroundGeolocation) return false;
      const id = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "Cicla Qui sta registrando il tuo viaggio",
          backgroundTitle: "Cicla Qui · tracking attivo",
          requestPermissions: true,
          stale: false,
          distanceFilter: 10,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (location: any, error: any) => {
          if (error || !location) return;
          ingestFix({
            lat: location.latitude,
            lng: location.longitude,
            t: location.time ?? Date.now(),
            speedKmh:
              location.speed != null && !Number.isNaN(location.speed)
                ? Math.max(0, location.speed * 3.6)
                : null,
            accuracyM: location.accuracy ?? null,
          });
        },
      );
      nativeWatcherRef.current = {
        remove: () => BackgroundGeolocation.removeWatcher({ id }),
      };
      return true;
    } catch {
      return false; // plugin non presente nel build nativo → fallback web
    }
  }, [ingestFix]);

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

  /** Watchdog: se non arrivano fix da 15s il watch web è morto → riarmalo. */
  const armWatchdog = useCallback(() => {
    if (watchdogRef.current != null) clearInterval(watchdogRef.current);
    watchdogRef.current = window.setInterval(() => {
      if (!stateRef.current?.recording) return;
      if (nativeWatcherRef.current) return; // il nativo non ha bisogno di watchdog
      if (Date.now() - lastFixAtRef.current > WATCHDOG_STALE_MS) armWebWatch();
    }, 5000);
  }, [armWebWatch]);

  const start = useCallback(() => {
    if (typeof navigator === "undefined") return;
    detectorRef.current.reset();
    classifierRef.current.reset();
    lastFixRef.current = null;
    dbmRef.current = { ...EMPTY_DBM };
    lastFixAtRef.current = Date.now();
    const startedAt = Date.now();
    setState({
      recording: true,
      startedAt,
      path: [],
      distanceKm: 0,
      durationS: 0,
      dominantMode: currentMode,
      distanceByMode: { ...EMPTY_DBM },
      nativeBackground: false,
      suspendedGapS: 0,
      lastGapAt: null,
    });
    // Avvia raccolta motion (accelerometro + heading) in background.
    // Se i permessi vengono negati, il fallback GPS-only continua a funzionare.
    motionStartedRef.current = false;
    void startMotionCollection().then((ok) => {
      motionStartedRef.current = ok;
    });
    // Prima prova il nativo (background reale); se fallisce, watch web.
    void armNativeWatch().then((native) => {
      if (native) {
        setState((prev) => ({ ...prev, nativeBackground: true }));
      } else {
        armWebWatch();
      }
    });
    armTicker();
    armWatchdog();
    wakeLockRef.current = wakeLockRef.current ?? createWakeLockKeeper();
    void wakeLockRef.current.acquire();
    // Keep-alive audio: impedisce al sistema di congelare la pagina a schermo
    // bloccato. Chiamato qui perché start() nasce da un tap dell'utente.
    void startKeepAlive().then((ok) => {
      keepAliveRef.current = ok;
    });

  }, [currentMode, armNativeWatch, armWebWatch, armTicker, armWatchdog]);

  const stop = useCallback(() => {
    if (watchIdRef.current != null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (nativeWatcherRef.current) {
      void nativeWatcherRef.current.remove().catch(() => {});
      nativeWatcherRef.current = null;
    }
    if (tickRef.current != null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (watchdogRef.current != null) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
    stopMotionCollection();
    motionStartedRef.current = false;
    void wakeLockRef.current?.release();
    clearActiveTrip();
    setState((prev) => ({ ...prev, recording: false, nativeBackground: false }));
  }, []);

  const reset = useCallback(() => {
    clearActiveTrip();
    dbmRef.current = { ...EMPTY_DBM };
    classifierRef.current.reset();
    detectorRef.current.reset();
    setState({
      recording: false,
      startedAt: null,
      path: [],
      distanceKm: 0,
      durationS: 0,
      dominantMode: "foot",
      distanceByMode: { ...EMPTY_DBM },
      nativeBackground: false,
      suspendedGapS: 0,
      lastGapAt: null,
    });
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (nativeWatcherRef.current) {
        void nativeWatcherRef.current.remove().catch(() => {});
      }
      if (tickRef.current != null) clearInterval(tickRef.current);
      if (watchdogRef.current != null) clearInterval(watchdogRef.current);
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
        modeCounts: { foot: 0, bike: 0, car: 0 },
        distanceByMode: state.distanceByMode,
        savedAt: Date.now(),
      });
    }
  }, [state]);

  // Flush esplicito quando la pagina sta per essere congelata/chiusa.
  useEffect(() => {
    const flush = () => {
      const s = stateRef.current;
      if (s?.recording && s.startedAt) {
        saveActiveTrip({
          startedAt: s.startedAt,
          path: s.path,
          distanceKm: s.distanceKm,
          dominantMode: s.dominantMode,
          modeCounts: { foot: 0, bike: 0, car: 0 },
          distanceByMode: s.distanceByMode,
          savedAt: Date.now(),
        });
      }
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("freeze", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("freeze", flush);
    };
  }, []);

  // Ripresa automatica all'avvio (reload, tab sospesa, PWA riaperta).
  useEffect(() => {
    const stored = loadActiveTrip();
    if (!stored) return;
    dbmRef.current = stored.distanceByMode ?? { ...EMPTY_DBM };
    detectorRef.current.reset();
    classifierRef.current.reset();
    lastFixRef.current = null;
    lastFixAtRef.current = Date.now();
    // Il tempo trascorso da quando l'app è stata congelata è un buco di tracking:
    // niente salto in linea d'aria sul primo fix e utente avvisato.
    const gapMs = Math.max(0, Date.now() - (stored.savedAt ?? stored.startedAt));
    const suspended = gapMs >= SUSPEND_GAP_MS;
    if (suspended) gapPendingRef.current = true;
    setState({
      recording: true,
      startedAt: stored.startedAt,
      path: stored.path,
      distanceKm: stored.distanceKm,
      durationS: Math.round((Date.now() - stored.startedAt) / 1000),
      dominantMode: stored.dominantMode,
      distanceByMode: stored.distanceByMode ?? { ...EMPTY_DBM },
      nativeBackground: false,
      suspendedGapS: suspended ? Math.round(gapMs / 1000) : 0,
      lastGapAt: suspended ? Date.now() : null,
    });

    motionStartedRef.current = false;
    void startMotionCollection().then((ok) => {
      motionStartedRef.current = ok;
    });
    void armNativeWatch().then((native) => {
      if (native) {
        setState((prev) => ({ ...prev, nativeBackground: true }));
      } else {
        armWebWatch();
      }
    });
    armTicker();
    armWatchdog();
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
      if (!nativeWatcherRef.current && lastFixAtRef.current > 0) {
        noteSuspension(Date.now() - lastFixAtRef.current);
      }
      if (!nativeWatcherRef.current) armWebWatch();
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
  }, [armWebWatch, armTicker, noteSuspension]);

  return { ...state, start, stop, reset };
}
