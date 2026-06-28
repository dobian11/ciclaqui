import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MapView } from "@/components/cicla/MapView";
import { useGeolocation } from "@/lib/use-geolocation";
import { Wind, Flame, Locate, Loader2, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

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

function MapHome() {
  const geo = useGeolocation(true);
  const [follow, setFollow] = useState(true);

  // Calorie live: formula MET semplificata su 1 minuto di esposizione
  // (placeholder per UI; sarà ricalcolata in trip-end).
  const userWeight = 70;
  const met = geo.mode === "bike" ? 6.8 : geo.mode === "foot" ? 3.5 : 1.3;
  const caloriesPerMin = Math.round((met * 3.5 * userWeight) / 200);

  // Qualità aria via Open-Meteo (gratis, no API key)
  const aqQuery = useQuery({
    queryKey: ["aq", geo.position?.[0]?.toFixed(2), geo.position?.[1]?.toFixed(2)],
    enabled: !!geo.position,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const [lat, lng] = geo.position!;
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=european_aqi,pm2_5`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("aqi fetch failed");
      const data = await res.json();
      return {
        aqi: Math.round(data?.current?.european_aqi ?? 0),
        pm25: Math.round(data?.current?.pm2_5 ?? 0),
      };
    },
  });

  const aqi = aqQuery.data?.aqi;
  const aqiLabel =
    aqi == null ? "—" : aqi <= 20 ? "Ottima" : aqi <= 40 ? "Buona" : aqi <= 60 ? "Media" : aqi <= 80 ? "Scarsa" : "Cattiva";
  const aqiDot =
    aqi == null ? "bg-muted-foreground" : aqi <= 40 ? "bg-cicla" : aqi <= 60 ? "bg-warning" : "bg-destructive";

  return (
    <div className="absolute inset-0 overflow-hidden bg-background">
      <MapView position={geo.position} mode={geo.mode} follow={follow} />

      {/* Top: search pill + mezzo status */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex flex-col gap-3 px-4 pt-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
      >
        <div className="pointer-events-auto flex items-center gap-3 rounded-3xl app-glass p-2.5 shadow-xl">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-cicla text-cicla-foreground shadow-cicla">
            <Search size={18} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Destinazione
            </span>
            <span className="text-sm font-medium text-foreground/90">
              Cerca percorsi ciclabili…
            </span>
          </div>
        </div>

        <div className="pointer-events-auto inline-flex self-start items-center gap-2 rounded-full app-glass px-3 py-1.5 shadow-lg">
          {geo.position ? (
            <>
              <span
                className={`inline-block size-2 rounded-full ring-2 ${MODE_RING[geo.mode]}/30`}
                style={{
                  background:
                    geo.mode === "bike"
                      ? "var(--mode-bike)"
                      : geo.mode === "foot"
                      ? "var(--mode-foot)"
                      : "var(--mode-car)",
                }}
              />
              <span className="text-xs font-semibold">{MODE_LABEL[geo.mode]}</span>
              <span className="text-[10px] text-muted-foreground">
                {geo.speedKmh.toFixed(1)} km/h
              </span>
            </>
          ) : geo.error ? (
            <span className="text-xs text-destructive">Posizione non disponibile</span>
          ) : (
            <>
              <Loader2 size={12} className="animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">GPS…</span>
            </>
          )}
        </div>
      </div>

      {/* Locate FAB sopra le stat card */}
      <button
        type="button"
        onClick={() => setFollow((f) => !f)}
        className={`absolute right-4 z-[1000] grid size-12 place-items-center rounded-full app-glass-strong shadow-xl transition-colors ${
          follow ? "text-cicla" : "text-muted-foreground"
        }`}
        style={{ bottom: "calc(220px + env(safe-area-inset-bottom, 0px))" }}
        aria-label="Centra mappa"
      >
        <Locate size={20} strokeWidth={2.4} />
      </button>

      {/* Stat cards sopra la navbar */}
      <div
        className="pointer-events-none absolute inset-x-0 z-[1000] px-4"
        style={{ bottom: "calc(110px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="pointer-events-auto mx-auto flex max-w-md gap-3">
          <div className="flex-1 rounded-3xl app-glass p-4 shadow-xl">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Flame size={12} className="text-warning" /> Calorie
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-2xl font-bold leading-none">
                {caloriesPerMin}
              </span>
              <span className="text-[10px] font-bold text-cicla">kcal/min</span>
            </div>
          </div>
          <div className="flex-1 rounded-3xl app-glass p-4 shadow-xl">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Wind size={12} className="text-info" /> Qualità Aria
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold leading-none">
                {aqQuery.isLoading ? "…" : aqiLabel}
              </span>
              <span className={`mb-0.5 inline-block size-2 rounded-full ${aqiDot}`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
