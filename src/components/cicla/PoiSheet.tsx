import { Navigation, X, ExternalLink, Loader2, MapPin, Locate, RotateCw, Flag } from "lucide-react";
import { POI_META, type Poi } from "@/lib/pois";
import { useConfirm } from "@/components/cicla/ConfirmDialog";

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const TAG_LABELS: Record<string, string> = {
  capacity: "Capienza",
  covered: "Coperto",
  fee: "A pagamento",
  access: "Accesso",
  operator: "Gestore",
  opening_hours: "Orari",
  bottle: "Borraccia",
  service_bicycle_pump: "Pompa bici",
  service_bicycle_tools: "Attrezzi",
  drinking_water: "Acqua potabile",
};

const YES_NO: Record<string, string> = {
  yes: "Sì",
  no: "No",
  free: "Gratuito",
  customers: "Solo clienti",
  permissive: "Consentito",
  private: "Privato",
};

function formatTagValue(v: string) {
  return YES_NO[v.toLowerCase()] ?? v;
}

export function PoiSheet({
  poi,
  origin,
  loadingRoute,
  onNavigate,
  onClose,
}: {
  poi: Poi;
  origin: [number, number] | null;
  loadingRoute: boolean;
  onNavigate: () => void;
  onClose: () => void;
}) {
  const meta = POI_META[poi.category];
  const distM = origin
    ? haversineMeters({ lat: origin[0], lng: origin[1] }, { lat: poi.lat, lng: poi.lng })
    : null;
  const distLabel =
    distM == null
      ? "—"
      : distM < 1000
      ? `${Math.round(distM)} m`
      : `${(distM / 1000).toFixed(distM < 10000 ? 2 : 1)} km`;

  const tags = poi.tags ?? {};
  const details = Object.entries(tags)
    .filter(([k]) => TAG_LABELS[k] !== undefined)
    .slice(0, 6);

  const gMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lng}&travelmode=bicycling`;

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 z-[1100] px-3"
      style={{ bottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto max-w-md rounded-3xl app-glass-strong p-4 shadow-2xl">
        <div className="mb-3 flex items-start gap-3">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-2xl text-lg"
            style={{ background: meta.color + "22", color: meta.color }}
          >
            {meta.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-[15px] font-bold leading-tight">
              {poi.name ?? meta.label}
            </h3>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{meta.label}</span>
              <span className="opacity-50">·</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <MapPin size={10} /> {distLabel}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 shrink-0 place-items-center rounded-full bg-white/5 text-muted-foreground hover:text-foreground"
            aria-label="Chiudi"
          >
            <X size={14} />
          </button>
        </div>

        {details.length > 0 && (
          <div className="mb-3 space-y-1.5 rounded-2xl bg-white/5 p-3">
            {details.map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between gap-3 text-[11px]"
              >
                <span className="text-muted-foreground">{TAG_LABELS[k]}</span>
                <span className="truncate text-right font-medium">{formatTagValue(v)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNavigate}
            disabled={loadingRoute || !origin}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-cicla px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-cicla-foreground shadow-cicla transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingRoute ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Navigation size={14} strokeWidth={2.8} />
            )}
            {loadingRoute ? "Calcolo…" : "Naviga"}
          </button>
          <a
            href={gMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-foreground/80 hover:text-foreground"
            aria-label="Apri in Google Maps"
            title="Apri in Google Maps"
          >
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}

const MODE_EMOJI: Record<"bike" | "foot" | "car", string> = { bike: "🚴", foot: "🚶", car: "🚗" };

export function NavigationBanner({
  distanceMeters,
  durationSec,
  totalDistanceMeters,
  recalculating,
  tracking,
  mode,
  onStop,
  onCancel,
  onRefresh,
  onArrived,
  onRecalc,
}: {
  distanceMeters: number;
  durationSec: number;
  totalDistanceMeters?: number;
  recalculating?: boolean;
  tracking?: boolean;
  mode?: "bike" | "foot" | "car";
  onStop: () => void;
  onCancel?: () => void;
  onRefresh?: () => void;
  onArrived?: () => void;
  onRecalc?: () => void;
}) {
  const { confirm, dialog } = useConfirm();
  const km = distanceMeters / 1000;
  const distLabel = km < 1 ? `${Math.round(distanceMeters)} m` : `${km.toFixed(km < 10 ? 2 : 1)} km`;
  const mins = Math.max(1, Math.round(durationSec / 60));
  const eta = new Date(Date.now() + durationSec * 1000);
  const etaLabel = eta.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  // progresso 0–1
  const progress = totalDistanceMeters && totalDistanceMeters > 0
    ? Math.min(1, Math.max(0, 1 - distanceMeters / totalDistanceMeters))
    : 0;
  const pct = Math.round(progress * 100);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-[1050] flex justify-center px-3"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 50px)" }}
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-cicla/95 px-3 py-2 text-cicla-foreground shadow-cicla backdrop-blur-md">
        {/* riga 1 — metriche live */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          {recalculating ? (
            <Loader2 size={12} className="shrink-0 animate-spin" />
          ) : (
            <Navigation size={12} strokeWidth={2.8} className="shrink-0" />
          )}
          <span className="font-display text-[12px] font-bold tabular-nums">{distLabel}</span>
          <span className="text-[10px] opacity-70">·</span>
          <span className="text-[11px] font-mono tabular-nums">{mins}′</span>
          <span className="text-[10px] opacity-70">·</span>
          <span className="whitespace-nowrap text-[10px] font-mono tabular-nums opacity-90">ETA {etaLabel}</span>

          <span className="ml-auto flex items-center gap-1">
            {tracking !== undefined && (
              <span
                className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                  tracking ? "bg-white text-cicla" : "bg-black/25 text-white/80"
                }`}
                title={tracking ? "Tracking attivo" : "Tracking in pausa"}
              >
                <span
                  className={`inline-block size-1.5 rounded-full ${tracking ? "animate-pulse bg-cicla" : "bg-white/50"}`}
                />
                {mode ? MODE_EMOJI[mode] : ""} {tracking ? "REC" : "—"}
              </span>
            )}
          </span>
        </div>

        {/* riga 2 — progress bar */}
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/25">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="font-mono text-[9px] tabular-nums opacity-90">{pct}%</span>
        </div>

        {/* riga 3 — azioni */}
        <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="grid size-7 shrink-0 place-items-center rounded-full bg-black/20 text-white active:scale-95"
              aria-label="Aggiorna posizione GPS"
              title="Aggiorna posizione"
            >
              <Locate size={12} strokeWidth={2.8} />
            </button>
          )}
          {onRecalc && (
            <button
              type="button"
              onClick={onRecalc}
              disabled={recalculating}
              className="grid size-7 shrink-0 place-items-center rounded-full bg-black/20 text-white active:scale-95 disabled:opacity-50"
              aria-label="Ricalcola percorso"
              title="Ricalcola"
            >
              <RotateCw size={12} strokeWidth={2.8} />
            </button>
          )}
          {onArrived && (
            <button
              type="button"
              onClick={onArrived}
              className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-cicla active:scale-95"
              aria-label="Sono arrivato"
              title="Sono arrivato"
            >
              <Flag size={12} strokeWidth={2.8} />
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={async () => {
                const res = await confirm({
                  title: "Annullare il tragitto?",
                  description:
                    "Il viaggio in corso verrà interrotto e i km percorsi non saranno salvati.",
                  confirmLabel: "Annulla tragitto",
                  cancelLabel: "Continua",
                  destructive: true,
                });
                if (res.ok) onCancel();
              }}
              className="inline-flex h-7 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-red-500/90 px-2.5 text-[10px] font-bold uppercase leading-none tracking-wider text-white active:scale-95"
              aria-label="Annulla tragitto"
              title="Annulla tragitto (non salva)"
            >
              <X size={12} strokeWidth={3} className="shrink-0" />
              <span>Annulla</span>
            </button>
          )}
          <button
            type="button"
            onClick={onStop}
            className="grid size-7 shrink-0 place-items-center rounded-full bg-black/25 text-white"
            aria-label="Chiudi navigazione"
            title="Chiudi navigazione"
          >
            <X size={12} strokeWidth={3} />
          </button>
        </div>

      </div>
      {dialog}
    </div>
  );
}
