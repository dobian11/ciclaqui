import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Search, Terminal, ChevronDown } from "lucide-react";

type LogRow = {
  id: string;
  created_at: string;
  event: string;
  source: string;
  status: string;
  error_message: string | null;
  user_id: string | null;
  meta: unknown;
};

const LEVELS = [
  { id: "all", label: "Tutti" },
  { id: "error", label: "Errori" },
  { id: "warn", label: "Avvisi" },
  { id: "info", label: "Info" },
] as const;

const LEVEL_STYLE: Record<string, string> = {
  error: "bg-destructive/15 text-destructive",
  warn: "bg-warning/15 text-warning",
  info: "bg-cicla/15 text-cicla",
};

function fmt(ts: string) {
  return new Date(ts).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Diagnostica server: mostra all'admin i log strutturati salvati dalle
 * server function (calcolo punti, errori accredito, anti-frode…).
 */
export function AdminLogsPanel() {
  const qc = useQueryClient();
  const [level, setLevel] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-server-logs"],
    refetchInterval: 30_000,
    queryFn: async (): Promise<LogRow[]> => {
      const { data, error } = await supabase
        .from("telemetry_events")
        .select("id, created_at, event, source, status, error_message, user_id, meta")
        .eq("source", "server")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (q.data ?? []).filter((r) => {
      if (level !== "all" && r.status !== level) return false;
      if (!term) return true;
      return `${r.event} ${JSON.stringify(r.meta ?? {})}`.toLowerCase().includes(term);
    });
  }, [q.data, level, query]);

  const counts = useMemo(() => {
    const c = { error: 0, warn: 0, info: 0 } as Record<string, number>;
    for (const r of q.data ?? []) if (c[r.status] !== undefined) c[r.status] += 1;
    return c;
  }, [q.data]);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Terminal className="size-4" /> Diagnostica server
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={LEVEL_STYLE.error}>
            {counts.error} errori
          </Badge>
          <Badge variant="secondary" className={LEVEL_STYLE.warn}>
            {counts.warn} avvisi
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["admin-server-logs"] })}
          >
            <RefreshCw className="mr-1.5 size-3.5" /> Aggiorna
          </Button>
        </div>
      </div>

      <p className="mt-2 text-[12px] text-muted-foreground">
        Ultimi 200 eventi registrati dalle funzioni server (calcolo punti, accrediti, anomalie).
        Nessun dato personale: solo identificativi troncati e metriche.
      </p>

      <div className="mt-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca evento o dettaglio (es. scored, credit-failed)…"
            className="h-9 pl-9 text-[13px]"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLevel(l.id)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                level === l.id
                  ? "border-cicla/50 bg-cicla/15 text-cicla"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {q.isLoading && (
          <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carico…
          </div>
        )}
        {!q.isLoading && rows.length === 0 && (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nessun log registrato per questo filtro.
          </div>
        )}
        {rows.map((r) => {
          const expanded = open === r.id;
          return (
            <div key={r.id} className="rounded-xl border bg-card/60">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : r.id)}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                <Badge
                  variant="secondary"
                  className={`${LEVEL_STYLE[r.status] ?? ""} shrink-0 uppercase`}
                >
                  {r.status}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[12px] font-semibold">{r.event}</div>
                  <div className="text-[11px] text-muted-foreground">{fmt(r.created_at)}</div>
                </div>
                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition ${
                    expanded ? "rotate-180" : ""
                  }`}
                />
              </button>
              {expanded && (
                <pre className="overflow-x-auto border-t bg-background/60 p-3 text-[11px] leading-relaxed">
                  {JSON.stringify(r.meta ?? {}, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
