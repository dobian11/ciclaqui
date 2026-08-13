import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCompanyPayouts } from "@/lib/payments.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Wallet, Coins, Clock, CheckCircle2 } from "lucide-react";

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "In attesa", className: "bg-warning/15 text-warning" },
  approved: { label: "Approvato", className: "bg-cicla/15 text-cicla" },
  paid: { label: "Pagato", className: "bg-cicla/20 text-cicla" },
  rejected: { label: "Rifiutato", className: "bg-destructive/15 text-destructive" },
};

function eur(n: number) {
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

/**
 * Sezione "Prelievi" dell'area ente: dà al titolare visibilità su quanti punti
 * i suoi membri hanno convertito in denaro e sullo stato delle richieste.
 */
export function CompanyPayoutsSection({ memberLabel }: { memberLabel: string }) {
  const qc = useQueryClient();
  const fetchPayouts = useServerFn(listCompanyPayouts);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");

  const q = useQuery({
    queryKey: ["company-payouts"],
    queryFn: () => fetchPayouts(),
  });

  const items = useMemo(() => {
    const list = q.data?.items ?? [];
    const term = query.trim().toLowerCase();
    return list.filter(
      (p) =>
        (status === "all" || p.status === status) &&
        (!term || p.user_name.toLowerCase().includes(term)),
    );
  }, [q.data, query, status]);

  const totals = q.data?.totals;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-4" />
            <span className="text-[11px] uppercase tracking-wider">In attesa</span>
          </div>
          <div className="mt-2 font-display text-2xl font-bold tabular-nums">
            {totals?.pending ?? 0}
          </div>
          <div className="text-xs text-muted-foreground">{eur(totals?.pending_eur ?? 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="size-4" />
            <span className="text-[11px] uppercase tracking-wider">Erogato</span>
          </div>
          <div className="mt-2 font-display text-2xl font-bold tabular-nums">
            {eur(totals?.paid_eur ?? 0)}
          </div>
          <div className="text-xs text-muted-foreground">prelievi pagati</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Coins className="size-4" />
            <span className="text-[11px] uppercase tracking-wider">Punti convertiti</span>
          </div>
          <div className="mt-2 font-display text-2xl font-bold tabular-nums">
            {totals?.points ?? 0}
          </div>
          <div className="text-xs text-muted-foreground">
            valore punto {eur(q.data?.eur_per_point ?? 0.01)}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Cerca ${memberLabel.toLowerCase()}…`}
            className="h-9 max-w-xs"
            aria-label="Cerca per nome"
          />
          <div className="flex flex-wrap gap-1">
            {["all", "pending", "approved", "paid", "rejected"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  status === s ? "bg-cicla/15 text-cicla" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {s === "all" ? "Tutti" : (STATUS[s]?.label ?? s)}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => qc.invalidateQueries({ queryKey: ["company-payouts"] })}
          >
            <RefreshCw className="mr-1.5 size-3.5" /> Aggiorna
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {q.isLoading && (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carico…
            </div>
          )}
          {!q.isLoading && items.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nessuna richiesta di prelievo.
            </div>
          )}
          {items.map((p) => {
            const meta = STATUS[p.status] ?? STATUS['pending']!;
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border bg-card/60 p-3"
              >
                <div className="grid size-9 place-items-center rounded-lg bg-muted text-cicla">
                  <Wallet className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.user_name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(p.created_at).toLocaleString("it-IT", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {p.points_redeemed} pt
                  </div>
                </div>
                <div className="font-display text-sm font-bold tabular-nums">
                  {eur(p.amount_eur)}
                </div>
                <Badge variant="secondary" className={meta.className}>
                  {meta.label}
                </Badge>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground">
          I pagamenti vengono processati centralmente da Cicla Qui: qui vedi solo lo
          stato delle richieste dei tuoi iscritti.
        </p>
      </Card>
    </div>
  );
}
