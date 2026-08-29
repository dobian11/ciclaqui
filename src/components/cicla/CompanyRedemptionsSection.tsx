import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listCompanyRedemptions, confirmCompanyRedemption } from "@/lib/rewards.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Ticket, Check, X, Loader2 } from "lucide-react";
import { confirmDialog as confirm } from "@/components/cicla/ConfirmDialog";

/**
 * Riscatti premi dei dipendenti: l'ente conferma l'erogazione e il dipendente
 * riceve subito una notifica push + email di conferma.
 */
export function CompanyRedemptionsSection() {
  const qc = useQueryClient();
  const list = useServerFn(listCompanyRedemptions);
  const decide = useServerFn(confirmCompanyRedemption);
  const [busy, setBusy] = useState<string | null>(null);
  const [reasonOpenId, setReasonOpenId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["company-redemptions"],
    queryFn: () => list({}),
    retry: false,
  });

  const items = data ?? [];
  const pending = items.filter((r) => r.status === "pending" || r.status === "active");

  async function act(id: string, action: "confirm" | "cancel", reason?: string) {
    if (action === "cancel") {
      const c = await confirm({
        title: "Annullare questo riscatto?",
        description: reason
          ? "Il dipendente riceverà una notifica con la motivazione indicata."
          : "Il dipendente riceverà una notifica di annullamento. Consigliato indicare un motivo.",
        confirmLabel: "Annulla riscatto",
        destructive: true,
      });
      if (!c.ok) return;
    }
    setBusy(id);
    try {
      await decide({ data: { id, action, reason: reason?.trim() || null } });
      toast.success(action === "confirm" ? "Riscatto confermato" : "Riscatto annullato");
      setReasonOpenId(null);
      setCancelReason("");
      await qc.invalidateQueries({ queryKey: ["company-redemptions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="mt-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Ticket className="size-4" /> Riscatti dei dipendenti
        </div>
        {pending.length > 0 && (
          <Badge variant="secondary" className="bg-cicla/15 text-[10px] text-cicla">
            {pending.length} da confermare
          </Badge>
        )}
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Confermando il riscatto il dipendente riceve una notifica push con il codice del premio.
      </p>

      {isLoading ? (
        <div className="mt-4 flex justify-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-4 text-center text-[11px] text-muted-foreground">Nessun riscatto per ora.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((r) => {
            const done = r.status === "confirmed";
            const cancelled = r.status === "cancelled";
            return (
              <li key={r.id} className="rounded-lg border border-border/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{r.reward_title}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {r.user_name} · {r.points_spent} pt
                      {r.cash_value_eur ? ` · € ${Number(r.cash_value_eur).toFixed(2)}` : ""}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px]">{r.code}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {new Date(r.redeemed_at).toLocaleString("it-IT")}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {done ? (
                      <Badge variant="secondary" className="text-[10px]">confermato</Badge>
                    ) : cancelled ? (
                      <Badge variant="secondary" className="text-[10px]">annullato</Badge>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          disabled={busy === r.id}
                          onClick={() => act(r.id, "confirm")}
                        >
                          <Check className="mr-1 size-3" /> Conferma
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-7 p-0 text-destructive"
                          aria-label="Annulla riscatto"
                          disabled={busy === r.id}
                          onClick={() => act(r.id, "cancel")}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
