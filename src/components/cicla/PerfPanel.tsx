import { Profiler, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { Activity, X, Trash2 } from "lucide-react";
import {
  aggregate,
  clearPerf,
  getPerfSnapshot,
  isPerfEnabled,
  recordPerf,
  startNetworkObserver,
  subscribePerf,
  type PerfKind,
} from "@/lib/perf-monitor";

const KIND_LABEL: Record<PerfKind, string> = {
  nav: "Loader",
  render: "Render",
  net: "Rete",
};

/**
 * Avvolge l'app: misura i tempi di commit React e i tempi di navigazione,
 * e mostra un pannello flottante con i colli di bottiglia in tempo reale.
 * Attivo in dev, oppure in produzione con `?perf=1`.
 */
export function PerfProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => setEnabled(isPerfEnabled()), []);

  if (!enabled) return <>{children}</>;

  return (
    <>
      <Profiler
        id="app"
        onRender={(_id, phase, actualDuration) => {
          if (actualDuration >= 1) recordPerf("render", `commit (${phase})`, actualDuration);
        }}
      >
        {children}
      </Profiler>
      <PerfPanel />
    </>
  );
}

function PerfPanel() {
  const router = useRouter();
  const entries = useSyncExternalStore(subscribePerf, getPerfSnapshot, () => []);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PerfKind | "all">("all");

  // Rete: PerformanceObserver sulle risorse fetch/XHR/script.
  useEffect(() => startNetworkObserver(), []);

  // Navigazione: dal comando di navigazione al match risolto (loader inclusi).
  useEffect(() => {
    let startedAt = 0;
    let target = "";
    const offStart = router.subscribe("onBeforeNavigate", (e) => {
      startedAt = performance.now();
      target = e.toLocation.pathname;
    });
    const offEnd = router.subscribe("onResolved", (e) => {
      if (!startedAt) return;
      recordPerf("nav", target || e.toLocation.pathname, performance.now() - startedAt);
      startedAt = 0;
    });
    return () => {
      offStart();
      offEnd();
    };
  }, [router]);

  const filtered = useMemo(
    () => (tab === "all" ? entries : entries.filter((e) => e.kind === tab)),
    [entries, tab],
  );
  const rows = useMemo(() => aggregate(filtered).slice(0, 12), [filtered]);
  const slowest = rows[0];

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Apri pannello performance"
        className="fixed left-3 z-[1400] flex items-center gap-1.5 rounded-full app-glass-strong px-3 py-1.5 text-[11px] font-bold text-foreground shadow-lg"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}
      >
        <Activity size={13} className="text-cicla" />
        {slowest ? `${slowest.max}ms` : "perf"}
      </button>
    );
  }

  return (
    <div
      className="fixed left-3 right-3 z-[1400] max-h-[52vh] overflow-hidden rounded-2xl app-glass-strong shadow-2xl md:left-auto md:w-[420px]"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Activity size={14} className="text-cicla" />
        <span className="font-display text-xs font-bold uppercase tracking-wider">Performance</span>
        <span className="text-[10px] text-muted-foreground">{entries.length} eventi</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={clearPerf}
            aria-label="Svuota metriche"
            className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            <Trash2 size={13} />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Chiudi pannello performance"
            className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex gap-1 px-3 pt-2">
        {(["all", "nav", "render", "net"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
              tab === k ? "bg-cicla text-cicla-foreground" : "text-muted-foreground"
            }`}
          >
            {k === "all" ? "Tutto" : KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="max-h-[38vh] overflow-y-auto px-3 py-2">
        {rows.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-muted-foreground">
            Nessuna metrica ancora: naviga nell'app per raccogliere dati.
          </p>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-1 font-medium">Operazione</th>
                <th className="py-1 text-right font-medium">n</th>
                <th className="py-1 text-right font-medium">medio</th>
                <th className="py-1 text-right font-medium">max</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.kind}:${r.label}`} className="border-t border-white/5">
                  <td className="py-1 pr-2">
                    <span className="mr-1 text-[9px] uppercase text-muted-foreground">
                      {KIND_LABEL[r.kind]}
                    </span>
                    <span className="break-all">{r.label}</span>
                  </td>
                  <td className="py-1 text-right tabular-nums text-muted-foreground">{r.count}</td>
                  <td className="py-1 text-right tabular-nums">{r.avg}ms</td>
                  <td
                    className={`py-1 text-right tabular-nums ${
                      r.max > 800 ? "text-destructive" : r.max > 300 ? "text-amber-400" : "text-cicla"
                    }`}
                  >
                    {r.max}ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
