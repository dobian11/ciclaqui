import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListRedemptions } from "@/lib/marketplace.functions";
import { rewardCategoryMeta } from "@/lib/reward-categories";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Gift } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  active: "Da usare",
  used: "Utilizzato",
  confirmed: "Confermato",
  sent: "Inviato",
  cancelled: "Annullato",
};

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("it-IT") : "—";
}

/** Admin Cicla Qui: elenco di tutti i premi riscattati dai dipendenti. */
export function AdminRedemptionsPanel() {
  const list = useServerFn(adminListRedemptions);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-redemptions"],
    queryFn: () => list({}),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-10">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Nessun premio riscattato per ora.
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((r) => {
        const meta = rewardCategoryMeta(r.category);
        return (
          <Card key={r.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Gift className="size-4 text-cicla" />
                  {meta.emoji} {r.reward_title}
                  {r.partner && (
                    <span className="text-[11px] font-normal text-muted-foreground">
                      · {r.partner}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {r.user_name} · {r.company_name} · riscattato il {fmt(r.redeemed_at)} · valido
                  fino al {fmt(r.expires_at)}
                </p>
                {r.cancel_reason && (
                  <p className="mt-1 text-[12px] text-destructive">Motivo: {r.cancel_reason}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant="secondary">{STATUS_LABEL[r.status] ?? r.status}</Badge>
                <span className="font-mono text-[12px] font-semibold">{r.code}</span>
                <span className="text-[11px] text-muted-foreground">
                  {r.points_spent} punti
                  {r.value_eur != null ? ` · € ${r.value_eur.toFixed(2)}` : ""}
                </span>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
