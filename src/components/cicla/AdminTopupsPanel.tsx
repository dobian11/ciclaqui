import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminListTopups, adminConfirmTopup } from "@/lib/company-wallet.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Landmark, CreditCard, CheckCircle2, RefreshCw } from "lucide-react";

function eur(n: number) {
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

/** Admin: conferma le ricariche del conto degli enti (bonifico o carta). */
export function AdminTopupsPanel() {
  const qc = useQueryClient();
  const list = useServerFn(adminListTopups);
  const confirm = useServerFn(adminConfirmTopup);
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-topups"],
    queryFn: () => list(),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  async function onConfirm(id: string) {
    setBusy(id);
    try {
      await confirm({ data: { topup_id: id } });
      toast.success("Ricarica accreditata");
      qc.invalidateQueries({ queryKey: ["admin-topups"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Conferma non riuscita");
    } finally {
      setBusy(null);
    }
  }

  const items = q.data ?? [];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Landmark className="size-4" /> Ricariche conto enti
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["admin-topups"] })}
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
            Nessuna ricarica registrata.
          </div>
        )}
        {items.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card/60 p-3">
            <div className="grid size-9 place-items-center rounded-lg bg-muted text-cicla">
              {t.method === "card" ? (
                <CreditCard className="size-4" />
              ) : (
                <Landmark className="size-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{t.company_name}</div>
              <div className="text-[11px] text-muted-foreground">
                rif. {t.reference ?? "—"} ·{" "}
                {new Date(t.created_at).toLocaleDateString("it-IT")}
              </div>
            </div>
            <div className="font-display text-sm font-bold tabular-nums">
              {eur(t.amount_eur)}
            </div>
            {t.status === "pending" ? (
              <Button size="sm" disabled={busy === t.id} onClick={() => onConfirm(t.id)}>
                {busy === t.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 size-3.5" />
                )}
                Conferma
              </Button>
            ) : (
              <Badge variant="secondary" className="bg-cicla/15 text-cicla">
                {t.status === "completed" ? "Accreditata" : t.status}
              </Badge>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
