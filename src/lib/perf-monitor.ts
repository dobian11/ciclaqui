/**
 * Perf monitor in-app (solo lato client).
 *
 * Raccoglie in memoria tre famiglie di metriche per individuare i colli di
 * bottiglia in tempo reale:
 *  - `nav`    → durata dei loader/route TanStack (dal click al match caricato)
 *  - `render` → tempi di commit React (via <Profiler>)
 *  - `net`    → chiamate esterne (fetch/XHR/script) da PerformanceObserver
 *
 * Attivazione: in dev è sempre attivo; in produzione si abilita con `?perf=1`
 * (persistito in localStorage) e si disabilita con `?perf=0`.
 */

export type PerfKind = "nav" | "render" | "net";

export type PerfEntry = {
  id: number;
  kind: PerfKind;
  label: string;
  ms: number;
  at: number;
  detail?: string;
};

const MAX_ENTRIES = 300;
const STORAGE_KEY = "cicla:perf";

let entries: PerfEntry[] = [];
let seq = 0;
const listeners = new Set<() => void>();
let snapshot: PerfEntry[] = entries;

function emit() {
  snapshot = entries;
  for (const l of listeners) l();
}

export function subscribePerf(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getPerfSnapshot(): PerfEntry[] {
  return snapshot;
}

export function clearPerf() {
  entries = [];
  emit();
}

export function recordPerf(kind: PerfKind, label: string, ms: number, detail?: string) {
  if (!Number.isFinite(ms) || ms < 0) return;
  entries = [{ id: ++seq, kind, label, ms: Math.round(ms), at: Date.now(), detail }, ...entries].slice(
    0,
    MAX_ENTRIES,
  );
  emit();
}

/** True se il pannello deve essere montato/raccogliere dati. */
export function isPerfEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("perf");
    if (q === "1") {
      window.localStorage.setItem(STORAGE_KEY, "1");
      return true;
    }
    if (q === "0") {
      window.localStorage.removeItem(STORAGE_KEY);
      return false;
    }
    if (window.localStorage.getItem(STORAGE_KEY) === "1") return true;
  } catch {
    /* storage non disponibile */
  }
  return import.meta.env.DEV;
}

/** Aggrega per label: conteggio, media, massimo, totale. */
export function aggregate(list: PerfEntry[]) {
  const map = new Map<string, { label: string; kind: PerfKind; count: number; total: number; max: number }>();
  for (const e of list) {
    const key = `${e.kind}:${e.label}`;
    const cur = map.get(key) ?? { label: e.label, kind: e.kind, count: 0, total: 0, max: 0 };
    cur.count += 1;
    cur.total += e.ms;
    cur.max = Math.max(cur.max, e.ms);
    map.set(key, cur);
  }
  return [...map.values()]
    .map((r) => ({ ...r, avg: Math.round(r.total / r.count) }))
    .sort((a, b) => b.total - a.total);
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    const last = u.pathname.split("/").filter(Boolean).pop() ?? u.pathname;
    return `${u.hostname === window.location.hostname ? "" : u.hostname + " "}${last || "/"}`;
  } catch {
    return url.slice(0, 60);
  }
}

/** Osserva le chiamate di rete (fetch/XHR/script). Ritorna la funzione di stop. */
export function startNetworkObserver(): () => void {
  if (typeof PerformanceObserver === "undefined") return () => {};
  const obs = new PerformanceObserver((list) => {
    for (const raw of list.getEntries()) {
      const e = raw as PerformanceResourceTiming;
      if (e.initiatorType !== "fetch" && e.initiatorType !== "xmlhttprequest" && e.initiatorType !== "script") {
        continue;
      }
      recordPerf("net", shortUrl(e.name), e.duration, e.initiatorType);
    }
  });
  try {
    obs.observe({ type: "resource", buffered: true });
  } catch {
    return () => {};
  }
  return () => obs.disconnect();
}
