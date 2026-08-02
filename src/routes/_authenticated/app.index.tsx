import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
// La mappa (componente + SDK Google) è il chunk più pesante della schermata:
// caricandola in lazy, controlli, GPS e UI si vedono subito.
const GoogleMapView = lazy(() =>
  import("@/components/cicla/GoogleMapView").then((m) => ({ default: m.GoogleMapView })),
);

import { PoiSheet, NavigationBanner } from "@/components/cicla/PoiSheet";
import { SourceErrorChip, ErrorDot } from "@/components/cicla/SourceErrorChip";
import { GpsPermissionSheet } from "@/components/cicla/GpsPermissionSheet";
import { TripSummarySheet, type TripSummary } from "@/components/cicla/TripSummarySheet";
import { useGeolocation } from "@/lib/use-geolocation";
import { useTripRecorder } from "@/lib/use-trip-recorder";
import { Wind, Flame, Locate, Loader2, Layers, X, Radio, AlertTriangle, RefreshCw, RotateCw } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAirQuality } from "@/lib/air-quality.functions";
import { endTrip } from "@/lib/trips.functions";
import { getMyTrackingWindow } from "@/lib/companies.functions";
import { computeRoute } from "@/lib/routes.functions";
import { decodePolyline } from "@/lib/polyline";
import { MapSearchBar } from "@/components/cicla/MapSearchBar";
import { POI_META, LAYER_CATEGORIES, type Poi, type PoiCategory } from "@/lib/pois";
import { supabase } from "@/integrations/supabase/client";
import { logTelemetry } from "@/lib/telemetry";
import { useMapPrefs } from "@/lib/use-map-prefs";

import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/app/")({
  component: MapHome,
});

const MODE_LABEL: Record<"foot" | "bike" | "car", string> = {
  foot: "A piedi",
  bike: "In bici",
  car: "In auto",
};

const MODE_RING: Record<"foot" | "bike" | "car", string> = {
  foot: "ring-mode-foot",
  bike: "ring-mode-bike",
  car: "ring-mode-car",
};

// Soglie auto-tracking
const MOVE_START_KMH = 2.5;       // movimento per avviare il viaggio
const IDLE_STOP_MS = 3 * 60_000;  // 3 min fermi → stop automatico
const MIN_DURATION_S = 30;        // viaggi < 30 s scartati

function isWithinWindow(win: { tracking_start: string | null; tracking_end: string | null; tracking_days: number[] | null } | null | undefined): boolean {
  if (!win) return true; // nessun ente collegato → sempre attivo
  const now = new Date();
  const day = now.getDay(); // 0=Dom..6=Sab
  const days = win.tracking_days && win.tracking_days.length > 0 ? win.tracking_days : null;
  if (days && !days.includes(day)) return false;
  if (!win.tracking_start || !win.tracking_end) return true;
  const [sh, sm] = win.tracking_start.split(":").map(Number);
  const [eh, em] = win.tracking_end.split(":").map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  return endMins >= startMins
    ? mins >= startMins && mins <= endMins
    : mins >= startMins || mins <= endMins; // finestra a cavallo della mezzanotte
}

function MapHome() {
  const geo = useGeolocation(true);
  const { prefs, setFollow, setPoiCategories, togglePoi } = useMapPrefs();
  const { follow, poiCategories } = prefs;
  const trip = useTripRecorder(geo.mode);
  const qc = useQueryClient();
  const [layersOpen, setLayersOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [poiLoading, setPoiLoading] = useState(false);
  const [layerError, setLayerError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<TripSummary | null>(null);

  // POI selection + in-app navigation
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);
  const [routeData, setRouteData] = useState<
    | { path: { lat: number; lng: number }[]; distanceMeters: number; durationSec: number; destination: Poi }
    | null
  >(null);

  const computeRouteFn = useServerFn(computeRoute);
  const routeMutation = useMutation({
    mutationFn: async (poi: Poi) => {
      if (!geo.position) throw new Error("Posizione non disponibile");
      const res = await computeRouteFn({
        data: {
          origin: { lat: geo.position[0], lng: geo.position[1] },
          destination: { lat: poi.lat, lng: poi.lng },
          mode: geo.mode,
        },
      });
      return { ...res, destination: poi };
    },
    onSuccess: (res) => {
      const path = decodePolyline(res.encoded);
      setRouteData({
        path,
        distanceMeters: res.distanceMeters,
        durationSec: res.durationSec,
        destination: res.destination,
      });
      setSelectedPoi(null);
      // Avvia automaticamente il tracking del tragitto: niente bottone manuale
      if (!trip.recording) trip.start();
      toast.success("Percorso pronto · tracking avviato");
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Impossibile calcolare il percorso");
    },
  });

  // ── NAVIGAZIONE LIVE: ricalcolo fuori percorso + auto-arrivo robusto ──
  const recalcLockRef = useRef(false);
  const ARRIVED_M = 25;          // soglia "arrivato" base
  const ARRIVED_MAX_M = 80;      // anche con GPS pessimo non superare mai questo
  const OFFROUTE_M = 20;         // soglia "fuori percorso"
  const RECALC_COOLDOWN = 10_000;
  const ARRIVAL_CONFIRM_FIXES = 2;     // n. fix consecutivi dentro soglia
  const ARRIVAL_DWELL_MS = 8_000;      // o: fermo X sec entro raggio allargato
  const DWELL_RADIUS_M = 60;           // raggio "in zona arrivo" per dwell
  const POOR_ACCURACY_M = 50;          // sopra a questa accuracy = GPS instabile

  const hav = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  };

  // contatori per conferma arrivo
  const arrivalFixesRef = useRef(0);
  const dwellStartRef = useRef<number | null>(null);

  const finishArrival = () => {
    arrivalFixesRef.current = 0;
    dwellStartRef.current = null;
    toast.success("🎯 Arrivato a destinazione");
    setRouteData(null);
    // se stavamo registrando il tragitto verso il POI, chiudilo e mostra il riepilogo
    if (trip.recording) {
      trip.stop();
      if (trip.path.length >= 2 && trip.durationS >= MIN_DURATION_S) {
        stopMutation.mutate();
      } else {
        trip.reset();
      }
    }
  };

  useEffect(() => {
    if (!routeData || !geo.position) {
      arrivalFixesRef.current = 0;
      dwellStartRef.current = null;
      return;
    }
    const cur = { lat: geo.position[0], lng: geo.position[1] };
    const dest = { lat: routeData.destination.lat, lng: routeData.destination.lng };
    const distToDest = hav(cur, dest);

    // soglia adattiva: con GPS impreciso allarghiamo, ma con un cap
    const acc = geo.accuracy ?? 0;
    const effectiveArrived = Math.min(
      ARRIVED_MAX_M,
      Math.max(ARRIVED_M, acc * 0.8),
    );

    // 1) conferma per fix consecutivi entro soglia
    if (distToDest <= effectiveArrived && acc <= POOR_ACCURACY_M) {
      arrivalFixesRef.current += 1;
      if (arrivalFixesRef.current >= ARRIVAL_CONFIRM_FIXES) {
        finishArrival();
        return;
      }
    } else {
      arrivalFixesRef.current = 0;
    }

    // 2) fallback "dwell": utente fermo da X sec dentro raggio allargato
    //    utile quando il GPS oscilla intorno al POI senza mai entrare sotto soglia
    const stationary = geo.speedKmh < 2;
    if (distToDest <= DWELL_RADIUS_M && stationary) {
      if (dwellStartRef.current == null) dwellStartRef.current = Date.now();
      else if (Date.now() - dwellStartRef.current >= ARRIVAL_DWELL_MS) {
        finishArrival();
        return;
      }
    } else {
      dwellStartRef.current = null;
    }

    // trova segmento di percorso più vicino
    let nearestIdx = 0, nearestDist = Infinity;
    for (let i = 0; i < routeData.path.length; i++) {
      const d = hav(cur, routeData.path[i]);
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    }

    // taglia la parte già percorsa → il percorso "si consuma" in tempo reale.
    // Richiediamo un avanzamento di almeno 2 nodi per evitare rerender continui
    // dovuti al jitter GPS quando si è quasi fermi.
    if (nearestIdx >= 2) {
      setRouteData((rd) => (rd ? { ...rd, path: rd.path.slice(nearestIdx) } : rd));
    }

    // ricalcolo se deviato troppo — ignora se accuracy pessima (evita falsi positivi)
    if (
      nearestDist > OFFROUTE_M &&
      acc <= POOR_ACCURACY_M &&
      !recalcLockRef.current &&
      !routeMutation.isPending
    ) {
      recalcLockRef.current = true;
      toast.message("⤴︎ Fuori percorso · ricalcolo…");
      routeMutation.mutate(routeData.destination);
      window.setTimeout(() => { recalcLockRef.current = false; }, RECALC_COOLDOWN);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.position, geo.accuracy, geo.speedKmh, routeData?.destination.id]);

  // distanza/tempo rimanenti live (somma del percorso residuo + tratto fino al primo nodo)
  const liveRouteInfo = useMemo(() => {
    if (!routeData || !geo.position) return null;
    const cur = { lat: geo.position[0], lng: geo.position[1] };
    let m = hav(cur, routeData.path[0]);
    for (let i = 1; i < routeData.path.length; i++) m += hav(routeData.path[i - 1], routeData.path[i]);
    const ratio = routeData.distanceMeters > 0 ? m / routeData.distanceMeters : 1;
    const sec = Math.max(15, Math.round(routeData.durationSec * Math.min(1, ratio)));
    return { distanceMeters: m, durationSec: sec };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeData, geo.position]);


  const isRefreshingRef = useRef(false);
  const refreshStartRef = useRef<number>(0);
  const aqPromiseRef = useRef<Promise<{ ok: boolean; error?: string }> | null>(null);

  const refreshLayers = () => {
    if (isRefreshingRef.current) return; // blocco richieste duplicate
    isRefreshingRef.current = true;
    refreshStartRef.current = performance.now();
    setLayerError(null);
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    void logTelemetry({ event: "refresh", source: "all", status: "start" });
    void logTelemetry({ event: "refresh", source: "poi", status: "start" });
    const aqStart = performance.now();
    void logTelemetry({ event: "refresh", source: "air_quality", status: "start" });
    aqPromiseRef.current = qc.refetchQueries({ queryKey: ["aq"] })
      .then(() => {
        void logTelemetry({
          event: "refresh",
          source: "air_quality",
          status: "success",
          durationMs: Math.round(performance.now() - aqStart),
        });
        return { ok: true };
      })
      .catch((e: any) => {
        void logTelemetry({
          event: "refresh",
          source: "air_quality",
          status: "error",
          durationMs: Math.round(performance.now() - aqStart),
          errorMessage: e?.message ?? String(e),
        });
        return { ok: false, error: e?.message ?? String(e) };
      });
  };
  const onRefreshComplete = async (poiResult?: { ok: boolean; error?: string }) => {
    if (!isRefreshingRef.current) return;
    const aqResult: { ok: boolean; error?: string } = await (aqPromiseRef.current ?? Promise.resolve({ ok: true }));
    const totalMs = Math.round(performance.now() - refreshStartRef.current);
    const allOk = (poiResult?.ok ?? true) && aqResult.ok;
    void logTelemetry({
      event: "refresh",
      source: "all",
      status: allOk ? "success" : "error",
      durationMs: totalMs,
      errorMessage: allOk ? null : (poiResult?.error || aqResult.error || "partial failure"),
      meta: { poi_ok: poiResult?.ok ?? true, aq_ok: aqResult.ok },
    });
    isRefreshingRef.current = false;
    setRefreshing(false);
    toast.message("Layer aggiornati");
  };
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const fetchWindow = useServerFn(getMyTrackingWindow);
  const winQuery = useQuery({
    queryKey: ["my-tracking-window"],
    queryFn: () => fetchWindow({}),
    enabled: authed,
    staleTime: 5 * 60_000,
  });
  const inWindow = isWithinWindow(winQuery.data as any);

  // GPS telemetry — fires on error transitions
  const lastGpsErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (geo.error && geo.error.message !== lastGpsErrorRef.current) {
      lastGpsErrorRef.current = geo.error.message;
      void logTelemetry({ event: "watch", source: "gps", status: "error", errorMessage: geo.error.message });
    } else if (!geo.error && lastGpsErrorRef.current) {
      lastGpsErrorRef.current = null;
      void logTelemetry({ event: "watch", source: "gps", status: "success" });
    }
  }, [geo.error]);


  const liveMode = trip.recording ? trip.dominantMode : geo.mode;

  const userWeight = 70;
  const met = liveMode === "bike" ? 6.8 : liveMode === "foot" ? 3.5 : 1.3;
  const caloriesPerMin = Math.round((met * 3.5 * userWeight) / 200);

  const fetchAQ = useServerFn(getAirQuality);
  const aqQuery = useQuery({
    queryKey: ["aq", geo.position?.[0]?.toFixed(2), geo.position?.[1]?.toFixed(2)],
    enabled: !!geo.position,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
    queryFn: () => fetchAQ({ data: { lat: geo.position![0], lng: geo.position![1] } }),
  });

  // dettagli AQ usati dal trittico in basso (BottomTrio)


  const polylinePath = useMemo(
    () => trip.path.map((p) => ({ lat: p.lat, lng: p.lng })),
    [trip.path],
  );

  const endTripFn = useServerFn(endTrip);
  const stopMutation = useMutation({
    mutationFn: async () => {
      const startedAt = new Date(trip.startedAt!).toISOString();
      const endedAtMs = Date.now();
      const endedAt = new Date(endedAtMs).toISOString();
      const path = trip.path.map((p) => ({ lat: p.lat, lng: p.lng, t: p.t, s: p.s }));
      // snapshot del tragitto PRIMA della chiamata: serve per il riepilogo
      // anche se reset() svuota lo stato
      const snapshot = {
        startedAt: trip.startedAt!,
        endedAt: endedAtMs,
        durationS: trip.durationS,
        distanceKm: trip.distanceKm,
        mode: trip.dominantMode,
        path: trip.path.slice(),
      };
      const res = await endTripFn({
        data: { started_at: startedAt, ended_at: endedAt, mode: trip.dominantMode, path },
      });
      return { res, snapshot };
    },
    onSuccess: ({ res, snapshot }) => {
      if (res.anomaly) {
        toast.warning(`Viaggio sospetto: ${res.anomaly_reason ?? ""}`);
      } else if (res.points_earned > 0) {
        toast.success(`+${res.points_earned} punti! ${res.distance_km.toFixed(2)} km`);
      } else {
        toast.message(`Viaggio salvato: ${res.distance_km.toFixed(2)} km`);
      }
      // mostra il riepilogo condivisibile (preferisci dati server)
      setLastSummary({
        ...snapshot,
        distanceKm: res.distance_km ?? snapshot.distanceKm,
        pointsEarned: res.points_earned ?? 0,
        anomaly: !!res.anomaly,
        anomalyReason: res.anomaly_reason ?? null,
      });
      trip.reset();
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["my-trips"] });
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Errore salvataggio viaggio");
    },
  });

  // ── AUTO-TRACKING: avvio/stop in base al movimento ──────────────
  const lastMoveAtRef = useRef<number>(Date.now());
  const gpsReadyRef = useRef<boolean>(false);
  const prevErrorRef = useRef<typeof geo.error>(null);

  // Avvio immediato appena il GPS diventa valido (dopo permessi/servizi attivati),
  // senza attendere il movimento. Si attiva solo dentro la finestra oraria.
  useEffect(() => {
    const validFix = !!geo.position && !geo.error && (geo.accuracy == null || geo.accuracy <= 100);
    const recovered = !!prevErrorRef.current && !geo.error; // transizione errore → ok
    const justBecameValid = validFix && (!gpsReadyRef.current || recovered);

    if (justBecameValid) {
      gpsReadyRef.current = true;
      if (!trip.recording && inWindow) {
        trip.start();
        lastMoveAtRef.current = Date.now();
        toast.message("Tracking avviato · GPS pronto", { duration: 2000 });
      }
    }
    if (!geo.position && !!geo.error) {
      gpsReadyRef.current = false;
    }
    prevErrorRef.current = geo.error;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.position, geo.error, geo.accuracy, inWindow]);

  useEffect(() => {
    if (!geo.position) return;
    const moving = geo.speedKmh >= MOVE_START_KMH;
    if (moving) lastMoveAtRef.current = Date.now();

    // auto-start solo dentro la finestra oraria impostata dall'ente
    if (!trip.recording && moving && inWindow) {
      trip.start();
      toast.message("Viaggio in corso · rilevato in automatico", { duration: 2200 });
      return;
    }

    // auto-stop: se esci dalla finestra o se sei fermo da troppo
    if (trip.recording && (!inWindow || Date.now() - lastMoveAtRef.current > IDLE_STOP_MS)) {
      trip.stop();
      if (trip.path.length >= 2 && trip.durationS >= MIN_DURATION_S) {
        stopMutation.mutate();
      } else {
        trip.reset();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.position, geo.speedKmh, trip.recording, inWindow]);



  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-background">
      <Suspense fallback={<MapSkeleton />}>
        <GoogleMapView
          position={geo.position}
          mode={liveMode}
          follow={follow}
          path={polylinePath}
          poiCategories={poiCategories}
          refreshKey={refreshKey}
          onRefreshError={(msg) => {
            setLayerError(msg);
            toast.error(msg);
            window.setTimeout(() => setLayerError(null), 5000);
            // sblocca il pulsante anche in caso di errore
            isRefreshingRef.current = false;
            setRefreshing(false);
          }}
          onRefreshComplete={onRefreshComplete}
          onPoiLoadingChange={setPoiLoading}
          onPoiSelect={(p) => setSelectedPoi(p)}
          selectedPoiId={selectedPoi?.id ?? routeData?.destination.id ?? null}
          routePath={routeData?.path ?? null}
          focusPoi={selectedPoi?.category === "place" ? selectedPoi : null}
        />
      </Suspense>


      <GpsPermissionSheet
        error={geo.error}
        loading={geo.loading}
        hasPosition={!!geo.position}
        onRetry={() => geo.retry()}
      />

      {lastSummary && (
        <TripSummarySheet summary={lastSummary} onClose={() => setLastSummary(null)} />
      )}


      {routeData && (
        <NavigationBanner
          distanceMeters={liveRouteInfo?.distanceMeters ?? routeData.distanceMeters}
          durationSec={liveRouteInfo?.durationSec ?? routeData.durationSec}
          totalDistanceMeters={routeData.distanceMeters}
          recalculating={routeMutation.isPending}
          tracking={trip.recording}
          mode={liveMode}
          onStop={() => setRouteData(null)}
          onCancel={() => {
            // annulla: ferma tracking SENZA salvare e chiude navigazione
            if (trip.recording) trip.stop();
            trip.reset();
            setRouteData(null);
            toast.message("Tragitto annullato · non salvato");
          }}
          onRefresh={() => geo.retry()}
          onArrived={() => finishArrival()}
          onRecalc={() => routeMutation.mutate(routeData.destination)}
        />
      )}

      {selectedPoi && (
        <PoiSheet
          poi={selectedPoi}
          origin={geo.position}
          loadingRoute={routeMutation.isPending}
          onNavigate={() => routeMutation.mutate(selectedPoi)}
          onClose={() => setSelectedPoi(null)}
        />
      )}


      {/* Top bar — pill compatte */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-center gap-2 px-3 pt-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
      >
        <MapSearchBar origin={geo.position} onSelect={(p) => setSelectedPoi(p)} />

        <div className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-full app-glass px-2.5 py-1.5 shadow-lg">
          {geo.loading ? (
            <>
              <Loader2 size={10} className="animate-spin text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Live…</span>
            </>
          ) : geo.position ? (
            <>
              <span
                className={`inline-block size-1.5 rounded-full ring-2 ${MODE_RING[liveMode]}/30`}
                style={{
                  background:
                    liveMode === "bike"
                      ? "var(--mode-bike)"
                      : liveMode === "foot"
                      ? "var(--mode-foot)"
                      : "var(--mode-car)",
                }}
              />
              <span className="text-[11px] font-semibold leading-none">{MODE_LABEL[liveMode]}</span>
              <span className="text-[10px] leading-none text-muted-foreground">
                {geo.speedKmh.toFixed(0)} km/h
              </span>
            </>
          ) : geo.error ? (
            <SourceErrorChip
              compact
              label="No GPS"
              detail={geo.error.message}
              onRetry={() => geo.retry?.()}
            />
          ) : (
            <>
              <Loader2 size={10} className="animate-spin text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">GPS…</span>
            </>
          )}
        </div>
      </div>

      {/* Badge viaggio in corso (auto) */}
      {trip.recording && (
        <div
          className="pointer-events-none absolute inset-x-0 z-[1000] flex justify-center"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 50px)" }}
        >
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-cicla/95 px-3 py-1 text-cicla-foreground shadow-cicla">
            <Radio size={11} className="animate-pulse" />
            <span className="font-display text-[11px] font-bold tabular-nums">
              {trip.distanceKm.toFixed(2)} km
            </span>
            <span className="text-[10px] opacity-80">·</span>
            <span className="font-mono text-[10px]">{fmtDuration(trip.durationS)}</span>
            <span className="text-[10px] opacity-80">·</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Auto</span>
          </div>
        </div>
      )}

      {/* Badge fuori finestra oraria */}
      {authed && !trip.recording && !inWindow && winQuery.data && (
        <div
          className="pointer-events-none absolute inset-x-0 z-[1000] flex justify-center"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 50px)" }}
        >
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-muted/90 px-2.5 py-1 text-foreground/80 shadow-lg backdrop-blur">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Fuori orario tracking</span>
            {winQuery.data.tracking_start && winQuery.data.tracking_end && (
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {winQuery.data.tracking_start.slice(0,5)}–{winQuery.data.tracking_end.slice(0,5)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Errori sorgenti dati (POI + Qualità Aria) */}
      {(layerError || aqQuery.isError) && (
        <div
          className="pointer-events-none absolute inset-x-0 z-[1000] flex flex-col items-center gap-1 px-3"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 50px)" }}
        >
          {layerError && (
            <SourceErrorChip
              label="Layer mappa"
              detail={layerError}
              onRetry={refreshLayers}
            />
          )}
          {aqQuery.isError && (
            <SourceErrorChip
              label="Qualità aria"
              detail="dati non disponibili"
              onRetry={() => aqQuery.refetch()}
            />
          )}
        </div>
      )}

      {/* Locate FAB */}
      <button
        type="button"
        onClick={() => setFollow(!follow)}
        className={`absolute right-4 z-[1000] grid size-11 place-items-center rounded-full app-glass-strong shadow-xl transition-colors ${
          follow ? "text-cicla" : "text-muted-foreground"
        }`}
        style={{ bottom: "calc(220px + env(safe-area-inset-bottom, 0px))" }}
        aria-label="Centra mappa"
      >
        <Locate size={18} strokeWidth={2.4} />
      </button>

      {/* Layers FAB */}
      <button
        type="button"
        onClick={() => setLayersOpen((o) => !o)}
        className={`absolute right-4 z-[1000] grid size-11 place-items-center rounded-full app-glass-strong shadow-xl transition-colors ${
          poiCategories.length > 0 ? "text-cicla" : "text-muted-foreground"
        }`}
        style={{ bottom: "calc(275px + env(safe-area-inset-bottom, 0px))" }}
        aria-label="Punti d'interesse"
      >
        {poiLoading ? (
          <Loader2 size={18} strokeWidth={2.4} className="animate-spin text-cicla" />
        ) : layersOpen ? (
          <X size={18} strokeWidth={2.4} />
        ) : (
          <Layers size={18} strokeWidth={2.4} />
        )}
        {poiCategories.length > 0 && !layersOpen && !poiLoading && !layerError && (
          <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-cicla text-[9px] font-bold text-cicla-foreground">
            {poiCategories.length}
          </span>
        )}
        {layerError && !poiLoading && <ErrorDot title={layerError} />}
      </button>

      {/* Refresh layers FAB */}
      <button
        type="button"
        onClick={refreshLayers}
        disabled={refreshing}
        className="absolute right-4 z-[1000] grid size-11 place-items-center rounded-full app-glass-strong text-muted-foreground shadow-xl transition-colors hover:text-cicla disabled:cursor-not-allowed disabled:opacity-50"
        style={{ bottom: "calc(330px + env(safe-area-inset-bottom, 0px))" }}
        aria-label="Aggiorna layer mappa"
      >
        <RefreshCw size={18} strokeWidth={2.4} className={refreshing ? "animate-spin text-cicla" : ""} />
      </button>

      {/* Layers panel compatto */}
      {layersOpen && (
        <div
          className="absolute right-4 z-[1000] w-52 rounded-2xl app-glass-strong p-1.5 shadow-2xl"
          style={{ bottom: "calc(385px + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="px-2 pb-1 pt-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
            Punti d'interesse
          </div>
          {(LAYER_CATEGORIES as readonly PoiCategory[]).map((cat) => {
            const meta = POI_META[cat];
            const active = poiCategories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => togglePoi(cat)}
                className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors ${
                  active ? "bg-cicla/15 text-foreground" : "hover:bg-white/5 text-foreground/80"
                }`}
              >
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-full text-[12px]"
                  style={{ background: meta.color + "22", color: meta.color }}
                >
                  {meta.emoji}
                </span>
                <span className="flex-1 text-[12px] font-medium">{meta.label}</span>
                <span
                  className={`grid size-3.5 place-items-center rounded-full border transition-colors ${
                    active ? "border-cicla bg-cicla" : "border-muted-foreground/40"
                  }`}
                >
                  {active && <span className="size-1.5 rounded-full bg-cicla-foreground" />}
                </span>
              </button>
            );
          })}
          <div className="px-2 pb-1 pt-1 text-[9px] text-muted-foreground">
            © OSM · zoom ≥ 13
          </div>
        </div>
      )}

      {/* Trittico in basso: kcal · SOS · qualità aria */}
      <BottomTrio
        caloriesPerMin={caloriesPerMin}
        mode={liveMode}
        aq={aqQuery.data}
        aqLoading={aqQuery.isFetching}
        aqError={aqQuery.isError}
        aqRetry={() => aqQuery.refetch()}
        livePoints={
          trip.recording
            ? Math.floor(
                trip.distanceKm *
                  (trip.dominantMode === "bike" ? 10 : trip.dominantMode === "foot" ? 3 : 0),
              )
            : null
        }
      />
    </div>
  );
}

function BottomTrio({
  caloriesPerMin,
  mode,
  aq,
  aqLoading,
  aqError,
  aqRetry,
  livePoints,
}: {
  caloriesPerMin: number;
  mode: "foot" | "bike" | "car";
  aq: any;
  aqLoading: boolean;
  aqError: boolean;
  aqRetry: () => void;
  livePoints: number | null;
}) {
  const [expanded, setExpanded] = useState<null | "kcal" | "aq">(null);
  const aqi = aq?.aqi ?? null;
  const aqiLabel = useMemo(() => {
    if (aqi == null) return "—";
    const category = (aq?.category ?? "").toString().toLowerCase();
    if (category.includes("scadente") || category.includes("poor") || aqi < 50) return "Qa scadente";
    if (category.includes("media") || category.includes("moderate") || aqi < 80) return "Qa media";
    return "Qa buona";
  }, [aq, aqi]);
  const aqiValue = aqi == null ? null : Math.round(aqi);
  const aqiDot =
    aqi == null ? "bg-muted-foreground" : aqi >= 80 ? "bg-cicla" : aqi >= 50 ? "bg-warning" : "bg-destructive";

  const kcalPerKm = mode === "bike" ? 30 : mode === "foot" ? 60 : 0;

  return (
    <>
      {/* Pannello dettagli espandibile */}
      {expanded && (
        <div
          className="pointer-events-auto absolute inset-x-0 z-[1000] px-4"
          style={{ bottom: "calc(178px + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="mx-auto max-w-md rounded-3xl app-glass-strong p-4 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold uppercase tracking-widest">
                {expanded === "kcal" ? "Calorie" : "Qa"}
              </h3>
              <button
                type="button"
                onClick={() => setExpanded(null)}
                className="grid size-7 place-items-center rounded-full bg-white/5 text-muted-foreground hover:text-foreground"
                aria-label="Chiudi"
              >
                <X size={14} />
              </button>
            </div>
            {expanded === "kcal" ? (
              <div className="space-y-2 text-[12px]">
                <Row label="Modalità" value={MODE_LABEL[mode]} />
                <Row label="kcal / minuto" value={`${caloriesPerMin}`} />
                <Row label="kcal / km stimate" value={kcalPerKm ? `${kcalPerKm}` : "—"} />
                <Row label="MET" value={mode === "bike" ? "6.8" : mode === "foot" ? "3.5" : "1.3"} />
                <p className="pt-1 text-[10px] leading-relaxed text-muted-foreground">
                  Stima basata su peso medio 70 kg. In auto non bruci calorie attive.
                </p>
              </div>
            ) : aqError ? (
              <div className="space-y-3 text-[12px]">
                <div className="flex items-start gap-2 rounded-2xl bg-destructive/15 p-3 ring-1 ring-destructive/40">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-destructive" />
                  <div className="flex-1">
                    <p className="font-semibold text-destructive">Dati non disponibili</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      Non riesco a contattare il servizio qualità aria. Verifica la connessione e riprova.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => aqRetry()}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-cicla px-3 py-2 text-[12px] font-bold uppercase tracking-wider text-cicla-foreground transition-transform active:scale-95"
                >
                  <RotateCw size={12} strokeWidth={2.8} /> Riprova
                </button>
              </div>
            ) : (
              <div className="space-y-2 text-[12px]">
                <Row label="AQI" value={aqLoading ? "…" : aqi != null ? String(Math.round(aqi)) : "—"} />
                <Row label="Stato" value={aqLoading ? "…" : aqiLabel} />
                <Row label="PM2.5" value={aq?.pm25 != null ? `${aq.pm25.toFixed(1)} µg/m³` : "—"} />
                <Row label="PM10" value={aq?.pm10 != null ? `${aq.pm10.toFixed(1)} µg/m³` : "—"} />
                <Row label="O₃" value={aq?.o3 != null ? `${aq.o3.toFixed(1)} µg/m³` : "—"} />
                <Row label="NO₂" value={aq?.no2 != null ? `${aq.no2.toFixed(1)} µg/m³` : "—"} />
                <p className="pt-1 text-[10px] leading-relaxed text-muted-foreground">
                  Dati live nella tua zona. Più alto l'AQI, migliore l'aria.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div
        className="pointer-events-none absolute inset-x-0 z-[1000] px-6"
        style={{ bottom: "calc(64px + 10mm + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="pointer-events-auto mx-auto flex max-w-md items-center justify-between">
          {/* Calorie */}
          <button
            type="button"
            onClick={() => setExpanded((e) => (e === "kcal" ? null : "kcal"))}
            className={`group relative grid size-16 place-items-center rounded-full app-glass-strong shadow-xl transition-transform active:scale-95 ${
              expanded === "kcal" ? "ring-2 ring-warning" : ""
            }`}
            aria-label="Calorie"
          >
            <Flame size={18} className="text-warning" />
            <span className="mt-0.5 font-display text-[13px] font-bold leading-none tabular-nums">
              {caloriesPerMin}
            </span>
            <span className="absolute -bottom-4 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              kcal/min
            </span>
            {livePoints != null && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-cicla px-1 text-[9px] font-bold text-cicla-foreground">
                +{livePoints}
              </span>
            )}
          </button>

          {/* SOS centrale */}
          <a
            href="https://www.db360app.it"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="SOS"
            className="relative grid size-16 place-items-center rounded-full bg-destructive text-white shadow-[0_12px_28px_-6px_rgba(220,38,38,0.6)] ring-4 ring-background transition-transform active:scale-95"
          >
            <AlertTriangle size={22} strokeWidth={2.6} />
            <span className="absolute -bottom-4 text-[10px] font-bold tracking-widest text-destructive">
              SOS
            </span>
          </a>

          {/* Qualità aria */}
          <button
            type="button"
            onClick={() => setExpanded((e) => (e === "aq" ? null : "aq"))}
            className={`group relative flex size-16 flex-col items-center justify-center rounded-full app-glass-strong shadow-xl transition-transform active:scale-95 ${
              expanded === "aq" ? "ring-2 ring-info" : aqError ? "ring-2 ring-destructive/60" : ""
            }`}
            aria-label="Qualità dell'aria"
          >
            {aqLoading ? (
              <Loader2 size={18} className="animate-spin text-info" />
            ) : aqError ? (
              <AlertTriangle size={18} className="text-destructive" />
            ) : (
              <Wind size={18} className="text-info" />
            )}
            <span
              className={`mt-0.5 max-w-[3.5rem] truncate px-1 text-center font-display font-bold leading-none ${
                aqError ? "text-[10px] text-destructive" : aqiLabel.length > 3 ? "text-[10px]" : "text-[13px]"
              }`}
            >
              {aqLoading ? "…" : aqError ? "Errore" : aqiLabel}
            </span>
            {!aqError && (
              <span className={`absolute right-2 top-2 inline-block size-1.5 rounded-full ${aqiDot}`} />
            )}
            <span className="absolute -bottom-4 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              Qa
            </span>
          </button>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-display font-bold tabular-nums">{value}</span>
    </div>
  );
}

/** Placeholder leggero mostrato mentre il chunk della mappa si scarica. */
function MapSkeleton() {
  return (
    <div className="absolute inset-0 bg-background">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-muted/20 via-muted/10 to-transparent" />
      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Caricamento mappa…
      </div>
    </div>
  );
}
