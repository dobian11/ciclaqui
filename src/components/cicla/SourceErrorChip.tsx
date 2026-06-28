import { AlertTriangle, RotateCw } from "lucide-react";

type Props = {
  label: string;
  detail?: string | null;
  onRetry?: () => void;
  compact?: boolean;
};

/**
 * Chip d'errore coerente per le sorgenti dati (GPS, POI, Qualità Aria).
 * - compact: badge minimale (per FAB / pillole top bar)
 * - default: pillola con label + retry
 */
export function SourceErrorChip({ label, detail, onRetry, compact }: Props) {
  if (compact) {
    return (
      <span
        title={detail ?? label}
        className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive ring-1 ring-destructive/40"
      >
        <AlertTriangle size={9} strokeWidth={2.8} />
        {label}
      </span>
    );
  }
  return (
    <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-destructive/90 px-2.5 py-1 text-destructive-foreground shadow-lg backdrop-blur">
      <AlertTriangle size={11} strokeWidth={2.6} />
      <span className="text-[11px] font-semibold">{label}</span>
      {detail && <span className="text-[10px] opacity-80">· {detail}</span>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors hover:bg-white/25"
          aria-label="Riprova"
        >
          <RotateCw size={9} strokeWidth={3} /> Riprova
        </button>
      )}
    </div>
  );
}

/** Punto-spia errore da sovrapporre a un FAB. */
export function ErrorDot({ title }: { title?: string }) {
  return (
    <span
      title={title}
      className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-destructive text-destructive-foreground ring-2 ring-background"
    >
      <AlertTriangle size={8} strokeWidth={3} />
    </span>
  );
}
