import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MapView } from "@/components/cicla/MapView";
import { useGeolocation } from "@/lib/use-geolocation";
import { Wind, Flame, Locate, Loader2, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/app/")({
  component: MapHome,
});

const SOS_URL = "https://www.db360app.it";

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

  return (
    <div className="absolute inset-0">
      <MapView position={geo.position} mode={geo.mode} follow={follow} />

      {/* TAG bar — sopra la navbar, 3 tag con SOS al centro */}
      <div
        className="pointer-events-none absolute inset-x-0 z-[1000] flex justify-center px-3"
        style={{ bottom: "calc(72px + env(safe-area-inset-bottom, 0))" }}
      >
        <div className="pointer-events-auto flex w-full max-w-md items-stretch gap-2">
          {/* Qualità aria */}
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border/60 bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
            <Wind size={18} className="text-info" />
            <div className="leading-tight">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Aria</div>
              <div className="text-sm font-semibold">
                {aqQuery.isLoading ? "…" : aqQuery.data ? `${aqQuery.data.aqi} AQI` : "—"}
              </div>
            </div>
          </div>

          {/* SOS — centro */}
          <a
            href={SOS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-2 rounded-2xl bg-mode-car px-5 py-2.5 text-white shadow-xl ring-2 ring-white/40 transition-transform active:scale-95"
          >
            <AlertTriangle size={20} strokeWidth={2.6} />
            <span className="text-base font-bold tracking-wider">SOS</span>
          </a>

          {/* Calorie */}
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border/60 bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
            <Flame size={18} className="text-warning" />
            <div className="leading-tight">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">kcal/min</div>
              <div className="text-sm font-semibold">{caloriesPerMin}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Status / mezzo rilevato */}
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-[1000] flex justify-center">
        <div
          className={`pointer-events-auto flex items-center gap-2 rounded-full border border-border/60 bg-card/95 px-4 py-2 shadow-lg backdrop-blur ring-2 ring-offset-2 ring-offset-background/0 ${MODE_RING[geo.mode]}/40`}
        >
          {geo.position ? (
            <>
              <span
                className="inline-block size-2.5 rounded-full"
                style={{
                  background:
                    geo.mode === "bike"
                      ? "var(--mode-bike)"
                      : geo.mode === "foot"
                      ? "var(--mode-foot)"
                      : "var(--mode-car)",
                }}
              />
              <span className="text-sm font-medium">{MODE_LABEL[geo.mode]}</span>
              <span className="text-xs text-muted-foreground">· {geo.speedKmh.toFixed(1)} km/h</span>
            </>
          ) : geo.error ? (
            <span className="text-xs text-mode-car">Posizione non disponibile</span>
          ) : (
            <>
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Ricerca posizione…</span>
            </>
          )}
        </div>
      </div>

      {/* Locate / re-center */}
      <button
        type="button"
        onClick={() => setFollow((f) => !f)}
        className={`absolute right-3 z-[1000] grid size-12 place-items-center rounded-full border bg-card shadow-lg transition-colors ${
          follow ? "border-cicla text-cicla" : "border-border text-muted-foreground"
        }`}
        style={{ bottom: "calc(140px + env(safe-area-inset-bottom, 0))" }}
        aria-label="Centra mappa"
      >
        <Locate size={20} />
      </button>
    </div>
  );
}
