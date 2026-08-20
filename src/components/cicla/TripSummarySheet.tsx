import { useMemo } from "react";
import { X, Share2, Bike, Footprints, Car, Trophy, Clock, Route as RouteIcon, AlertTriangle, Check } from "lucide-react";
import type { TripPoint } from "@/lib/use-trip-recorder";
import type { TripMode } from "@/components/cicla/GoogleMapView";
import { toast } from "sonner";

export interface TripSummary {
  startedAt: number;
  endedAt: number;
  durationS: number;
  distanceKm: number;
  mode: TripMode;
  path: TripPoint[];
  pointsEarned: number;
  anomaly: boolean;
  anomalyReason: string | null;
  /** Coppe/maratone a cui questo viaggio ha contribuito */
  challenges?: { id: string; title: string; icon?: string | null; delta: number; unit: string; goal: number }[];
}

interface Props {
  summary: TripSummary;
  onClose: () => void;
}

const MODE_META: Record<TripMode, { Icon: typeof Bike; label: string; tone: string }> = {
  bike: { Icon: Bike, label: "Bici", tone: "text-cicla bg-cicla/15 border-cicla/40" },
  foot: { Icon: Footprints, label: "A piedi", tone: "text-amber-400 bg-amber-500/15 border-amber-500/40" },
  car: { Icon: Car, label: "Auto", tone: "text-destructive bg-destructive/10 border-destructive/40" },
};

/**
 * Renderizza un mini-tracciato SVG normalizzato (no dipendenze esterne).
 * Calcola bounding box → mappa in viewport 200x100 con padding 6px.
 */
function MiniMap({ path }: { path: TripPoint[] }) {
  const d = useMemo(() => {
    if (path.length < 2) return "";
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const p of path) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }
    const W = 200, H = 100, P = 6;
    const dLat = Math.max(1e-6, maxLat - minLat);
    const dLng = Math.max(1e-6, maxLng - minLng);
    const sx = (W - 2 * P) / dLng;
    const sy = (H - 2 * P) / dLat;
    const s = Math.min(sx, sy);
    // centra
    const offX = (W - dLng * s) / 2;
    const offY = (H - dLat * s) / 2;
    return path
      .map((p, i) => {
        const x = offX + (p.lng - minLng) * s;
        const y = H - offY - (p.lat - minLat) * s;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [path]);

  return (
    <svg viewBox="0 0 200 100" className="h-24 w-full rounded-xl bg-background/60">
      {d && <path d={d} fill="none" stroke="hsl(var(--cicla))" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {path.length > 0 && (
        <>
          {/* start */}
          <circle r="3" cx={d ? d.split(" ")[0].slice(1) : 0} cy={d ? d.split(" ")[1] : 0} fill="hsl(var(--cicla))" />
        </>
      )}
    </svg>
  );
}

function fmtDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${sec.toString().padStart(2, "0")}s`;
  return `${sec}s`;
}

function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function TripSummarySheet({ summary, onClose }: Props) {
  const meta = MODE_META[summary.mode];
  const Icon = meta.Icon;
  const avgKmh = summary.durationS > 0 ? (summary.distanceKm / (summary.durationS / 3600)) : 0;

  const shareText = useMemo(() => {
    return [
      `🚴 Ho appena percorso ${summary.distanceKm.toFixed(2)} km con Cicla Qui`,
      `⏱️ ${fmtDuration(summary.durationS)} · ${meta.label}`,
      summary.pointsEarned > 0 ? `🏆 +${summary.pointsEarned} punti guadagnati` : null,
      `#CiclaQui #MobilitàSostenibile`,
    ].filter(Boolean).join("\n");
  }, [summary, meta.label]);

  const handleShare = async () => {
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title: "Il mio viaggio · Cicla Qui", text: shareText });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      toast.success("Riepilogo copiato negli appunti");
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error("Condivisione non disponibile");
    }
  };

  return (
    <div className="fixed inset-0 z-[1900] flex items-end justify-center bg-background/85 px-3 pb-3 backdrop-blur-md sm:items-center sm:p-6">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-cicla/20 via-card to-card p-5">
          <button
            type="button"
            aria-label="Chiudi"
            onClick={onClose}
            className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-background/60 text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-3">
            <div className={`grid size-12 place-items-center rounded-2xl border ${meta.tone}`}>
              <Icon size={22} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Viaggio completato</p>
              <h2 className="font-display text-xl font-bold leading-tight">
                {summary.distanceKm.toFixed(2)} km · {meta.label}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {fmtTime(summary.startedAt)} → {fmtTime(summary.endedAt)}
              </p>
            </div>
          </div>
        </div>

        {/* Map preview */}
        <div className="px-5 pt-4">
          <MiniMap path={summary.path} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 p-4">
          <Stat icon={RouteIcon} label="Distanza" value={`${summary.distanceKm.toFixed(2)} km`} />
          <Stat icon={Clock} label="Durata" value={fmtDuration(summary.durationS)} />
          <Stat icon={Trophy} label="Punti" value={summary.pointsEarned > 0 ? `+${summary.pointsEarned}` : "0"} highlight={summary.pointsEarned > 0} />
        </div>

        <div className="px-5 pb-2 text-[11px] text-muted-foreground">
          Velocità media: <span className="text-foreground">{avgKmh.toFixed(1)} km/h</span>
          {summary.path.length > 0 && (
            <> · Punti GPS: <span className="text-foreground">{summary.path.length}</span></>
          )}
        </div>

        {!summary.anomaly && (summary.challenges?.length ?? 0) > 0 && (
          <div className="mx-5 mb-3 rounded-2xl border border-cicla/30 bg-cicla/10 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-cicla">
              <Trophy size={12} /> Progressi nelle coppe
            </p>
            <ul className="mt-1.5 space-y-1">
              {summary.challenges!.map((c) => (
                <li key={c.id} className="flex items-center gap-1.5 text-[11px] text-foreground">
                  <span>{c.icon || "🏆"}</span>
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-cicla">
                    +{c.delta < 1 ? c.delta.toFixed(2) : c.delta.toFixed(1)} {c.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.anomaly && (
          <div className="mx-5 mb-3 flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <div className="text-[11px] leading-relaxed">
              <strong>Viaggio in revisione.</strong> {summary.anomalyReason ?? "Anomalia rilevata"} — nessun punto assegnato.
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 border-t border-border bg-card p-3">
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-background/60 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-background"
          >
            <Share2 size={14} />
            Condividi
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-cicla px-4 py-2.5 text-sm font-semibold text-cicla-foreground shadow-cicla"
          >
            <Check size={14} />
            Fatto
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, highlight = false }: { icon: typeof Trophy; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${highlight ? "border-cicla/40 bg-cicla/10" : "border-border bg-background/40"}`}>
      <Icon size={14} className={highlight ? "text-cicla" : "text-muted-foreground"} />
      <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-base font-semibold ${highlight ? "text-cicla" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
