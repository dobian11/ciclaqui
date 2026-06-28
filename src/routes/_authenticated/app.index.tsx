import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMapView } from "@/components/cicla/GoogleMapView";
import { useGeolocation } from "@/lib/use-geolocation";
import { useTripRecorder } from "@/lib/use-trip-recorder";
import { Wind, Flame, Locate, Loader2, Search, Trophy, Layers, X, Radio, AlertTriangle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAirQuality } from "@/lib/air-quality.functions";
import { endTrip } from "@/lib/trips.functions";
import { POI_META, type PoiCategory } from "@/lib/pois";
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

function MapHome() {
  const geo = useGeolocation(true);
  const [follow, setFollow] = useState(true);
  const trip = useTripRecorder(geo.mode);
  const qc = useQueryClient();
  const [poiCategories, setPoiCategories] = useState<PoiCategory[]>([]);
  const [layersOpen, setLayersOpen] = useState(false);
  const togglePoi = (cat: PoiCategory) =>
    setPoiCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));

  const liveMode = trip.recording ? trip.dominantMode : geo.mode;

  const userWeight = 70;
  const met = liveMode === "bike" ? 6.8 : liveMode === "foot" ? 3.5 : 1.3;
  const caloriesPerMin = Math.round((met * 3.5 * userWeight) / 200);

  const fetchAQ = useServerFn(getAirQuality);
  const aqQuery = useQuery({
    queryKey: ["aq", geo.position?.[0]?.toFixed(2), geo.position?.[1]?.toFixed(2)],
    enabled: !!geo.position,
    staleTime: 10 * 60_000,
    queryFn: () => fetchAQ({ data: { lat: geo.position![0], lng: geo.position![1] } }),
  });

  const aqi = aqQuery.data?.aqi ?? null;
  const aqiLabel = aqQuery.data?.category ?? (aqi == null ? "—" : String(aqi));
  const aqiDot =
    aqi == null ? "bg-muted-foreground" : aqi >= 80 ? "bg-cicla" : aqi >= 50 ? "bg-warning" : "bg-destructive";

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

    // auto-start
    if (!trip.recording && moving) {
      trip.start();
      toast.message("Viaggio in corso · rilevato in automatico", { duration: 2200 });
      return;
    }

    // auto-stop dopo inattività
    if (trip.recording && Date.now() - lastMoveAtRef.current > IDLE_STOP_MS) {
      trip.stop();
      if (trip.path.length >= 2 && trip.durationS >= MIN_DURATION_S) {
        stopMutation.mutate();
      } else {
        trip.reset();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.position, geo.speedKmh, trip.recording]);

  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-background">
      <GoogleMapView position={geo.position} mode={liveMode} follow={follow} path={polylinePath} poiCategories={poiCategories} />

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

      {/* Layers panel compatto */}
      {layersOpen && (
        <div
          className="absolute right-4 z-[1000] w-52 rounded-2xl app-glass-strong p-1.5 shadow-2xl"
          style={{ bottom: "calc(330px + env(safe-area-inset-bottom, 0px))" }}
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

      {/* Stat pill compatta in basso */}
      <div
        className="pointer-events-none absolute inset-x-0 z-[1000] px-3"
        style={{ bottom: "calc(100px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-2 rounded-full app-glass px-3 py-1.5 shadow-xl">
          <div className="flex flex-1 items-center gap-1.5">
            <Flame size={12} className="shrink-0 text-warning" />
            <span className="font-display text-sm font-bold tabular-nums leading-none">
              {caloriesPerMin}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              kcal/min
            </span>
          </div>
          <span className="h-3 w-px bg-white/10" />
          <div className="flex flex-1 items-center gap-1.5">
            <Wind size={12} className="shrink-0 text-info" />
            <span className="font-display text-sm font-bold leading-none">
              {aqQuery.isLoading ? "…" : aqiLabel}
            </span>
            <span className={`inline-block size-1.5 rounded-full ${aqiDot}`} />
          </div>
          {trip.recording && (
            <>
              <span className="h-3 w-px bg-white/10" />
              <div className="flex items-center gap-1">
                <Trophy size={11} className="shrink-0 text-cicla" />
                <span className="font-display text-sm font-bold tabular-nums leading-none text-cicla">
                  +
                  {Math.floor(
                    trip.distanceKm *
                      (trip.dominantMode === "bike" ? 10 : trip.dominantMode === "foot" ? 3 : 0),
                  )}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
