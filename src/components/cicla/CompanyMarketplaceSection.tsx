import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listDoctorbikeCatalog, purchaseDoctorbikeItem } from "@/lib/marketplace.functions";
import { getCompanyWallet } from "@/lib/company-wallet.functions";
import { rewardCategoryMeta } from "@/lib/reward-categories";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingBag, Wallet, Wrench } from "lucide-react";

/**
 * Marketplace Doctorbike: l'ente acquista servizi con il conto prepagato e
 * decide con quanti punti i dipendenti possono riscattarli nelle gare.
 */
export function CompanyMarketplaceSection() {
  const qc = useQueryClient();
  const listItems = useServerFn(listDoctorbikeCatalog);
  const getWallet = useServerFn(getCompanyWallet);
  const purchase = useServerFn(purchaseDoctorbikeItem);

  const { data: items, isLoading } = useQuery({
    queryKey: ["doctorbike-catalog"],
    queryFn: () => listItems({}),
  });
  const { data: wallet } = useQuery({
    queryKey: ["company-wallet"],
    queryFn: () => getWallet({}),
  });

  const [form, setForm] = useState<Record<string, { qty: string; points: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const balance = Number(wallet?.balance_eur ?? 0);

  async function buy(id: string, defaults: { qty: number; points: number }) {
    const f = form[id];
    const qty = Number(f?.qty ?? defaults.qty) || defaults.qty;
    const points = Number(f?.points ?? defaults.points) || defaults.points;
    if (points < 500) {
      toast.error("Il punteggio richiesto deve essere almeno 500");
      return;
    }
    setBusy(id);
    try {
      const res = await purchase({ data: { item_id: id, qty, points_cost: points } });
      toast.success(`${res.title} aggiunto ai premi`, {
        description: `Disponibili ${res.stock ?? qty} · riscattabile a ${res.points_cost} punti`,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["company-wallet"] }),
        qc.invalidateQueries({ queryKey: ["company-rewards"] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Acquisto non riuscito");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) {
    return (
      <div className="grid place-items-center py-10">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingBag className="size-4 text-cicla" /> Servizi Doctorbike Italia
          </div>
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
            Acquisti con il credito del conto ente e scegli il punteggio da raggiungere: il premio
            compare subito nell'app dei tuoi iscritti ed è utilizzabile solo nei centri Doctorbike.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-semibold">
          <Wallet className="size-4 text-cicla" /> € {balance.toFixed(2)}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(items ?? []).map((it) => {
          const meta = rewardCategoryMeta(it.category);
          const f = form[it.id] ?? { qty: "1", points: String(it.suggested_points) };
          const total = it.price_eur * (Number(f.qty) || 1);
          const affordable = total <= balance;
          return (
            <Card key={it.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {meta.emoji} {it.title}
                  </div>
                  <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                    {it.description}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  € {it.price_eur.toFixed(2)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Quantità
                  <Input
                    inputMode="numeric"
                    value={f.qty}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, [it.id]: { ...f, qty: e.target.value } }))
                    }
                    className="mt-1"
                  />
                </label>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Punti richiesti
                  <Input
                    inputMode="numeric"
                    value={f.points}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, [it.id]: { ...f, points: e.target.value } }))
                    }
                    className="mt-1"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Wrench className="size-3" /> Valido 12 mesi
                </span>
                <span className="font-semibold text-foreground">Totale € {total.toFixed(2)}</span>
              </div>

              <Button
                className="w-full"
                disabled={busy === it.id || !affordable}
                onClick={() => buy(it.id, { qty: 1, points: it.suggested_points })}
              >
                {busy === it.id && <Loader2 className="mr-2 size-4 animate-spin" />}
                {affordable ? "Acquista e metti in palio" : "Ricarica il conto ente"}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
