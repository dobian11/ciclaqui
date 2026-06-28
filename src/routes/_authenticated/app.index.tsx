import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMapView } from "@/components/cicla/GoogleMapView";
import { useGeolocation } from "@/lib/use-geolocation";
import { useTripRecorder } from "@/lib/use-trip-recorder";
import { Wind, Flame, Locate, Loader2, Search, Layers, X, Radio, AlertTriangle, RefreshCw } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAirQuality } from "@/lib/air-quality.functions";
import { endTrip } from "@/lib/trips.functions";
import { getMyTrackingWindow } from "@/lib/companies.functions";
import { POI_META, type PoiCategory } from "@/lib/pois";
import { supabase } from "@/integrations/supabase/client";

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
  const [follow, setFollow] = useState(true);
  const trip = useTripRecorder(geo.mode);
  const qc = useQueryClient();
  const [poiCategories, setPoiCategories] = useState<PoiCategory[]>([]);
  const [layersOpen, setLayersOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshLayers = () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    qc.invalidateQueries({ queryKey: ["aq"] });
    window.setTimeout(() => setRefreshing(false), 900);
    toast.message("Layer aggiornati");
  };
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);
  const togglePoi = (cat: PoiCategory) =>
    setPoiCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));

  const fetchWindow = useServerFn(getMyTrackingWindow);
  const winQuery = useQuery({
    queryKey: ["my-tracking-window"],
    queryFn: () => fetchWindow({}),
    enabled: authed,
    staleTime: 5 * 60_000,
  });
  const inWindow = isWithinWindow(winQuery.data as any);


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
      const endedAt = new Date().toISOString();
      const path = trip.path.map((p) => ({ lat: p.lat, lng: p.lng, t: p.t, s: p.s }));
      return endTripFn({
        data: { started_at: startedAt, ended_at: endedAt, mode: trip.dominantMode, path },
      });
    },
    onSuccess: (res) => {
      if (res.anomaly) {
        toast.warning(`Viaggio sospetto: ${res.anomaly_reason ?? ""}`);
      } else if (res.points_earned > 0) {
        toast.success(`+${res.points_earned} punti! ${res.distance_km.toFixed(2)} km`);
      } else {
        toast.message(`Viaggio salvato: ${res.distance_km.toFixed(2)} km`);
      }
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
      <GoogleMapView position={geo.position} mode={liveMode} follow={follow} path={polylinePath} poiCategories={poiCategories} refreshKey={refreshKey} />

      {/* Top bar — pill compatte */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-center gap-2 px-3 pt-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
      >
        <div className="pointer-events-auto flex flex-1 items-center gap-2 rounded-full app-glass px-2.5 py-1.5 shadow-lg">
          <div className="grid size-6 shrink-0 place-items-center rounded-full bg-cicla text-cicla-foreground">
            <Search size={12} strokeWidth={2.8} />
          </div>
          <span className="truncate text-[11px] font-medium text-foreground/80">Cerca percorsi…</span>
        </div>

        <div className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-full app-glass px-2.5 py-1.5 shadow-lg">
          {geo.position ? (
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
            <span className="text-[11px] text-destructive">No GPS</span>
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

      {/* Locate FAB */}
      <button
        type="button"
        onClick={() => setFollow((f) => !f)}
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
        {layersOpen ? <X size={18} strokeWidth={2.4} /> : <Layers size={18} strokeWidth={2.4} />}
        {poiCategories.length > 0 && !layersOpen && (
          <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-cicla text-[9px] font-bold text-cicla-foreground">
            {poiCategories.length}
          </span>
        )}
      </button>

      {/* Refresh layers FAB */}
      <button
        type="button"
        onClick={refreshLayers}
        className="absolute right-4 z-[1000] grid size-11 place-items-center rounded-full app-glass-strong text-muted-foreground shadow-xl transition-colors hover:text-cicla"
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
          {(Object.keys(POI_META) as PoiCategory[]).map((cat) => {
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
        aqLoading={aqQuery.isLoading}
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
  livePoints,
}: {
  caloriesPerMin: number;
  mode: "foot" | "bike" | "car";
  aq: any;
  aqLoading: boolean;
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
              expanded === "aq" ? "ring-2 ring-info" : ""
            }`}
            aria-label="Qualità dell'aria"
          >
            <Wind size={18} className="text-info" />
            <span
              className={`mt-0.5 max-w-[3.5rem] truncate px-1 text-center font-display font-bold leading-none ${
                aqiLabel.length > 3 ? "text-[10px]" : "text-[13px]"
              }`}
            >
              {aqLoading ? "…" : aqiLabel}
            </span>
            <span
              className={`absolute right-2 top-2 inline-block size-1.5 rounded-full ${aqiDot}`}
            />
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
