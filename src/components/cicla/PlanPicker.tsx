import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PLANS, getPlan, type PlanId } from "@/lib/plans";
import { activateCompanySubscription, previewDiscountCode } from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Check, CreditCard, Loader2, TicketPercent } from "lucide-react";

/**
 * Selettore piano + codice sconto. L'abbonamento va attivato PRIMA di poter
 * inviare i documenti di verifica.
 */
export function PlanPicker({
  memberLabel = "dipendenti",
  onActivated,
}: {
  memberLabel?: string;
  onActivated?: () => void | Promise<void>;
}) {
  const activate = useServerFn(activateCompanySubscription);
  const preview = useServerFn(previewDiscountCode);
  const [plan, setPlan] = useState<PlanId>("starter");
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [discount, setDiscount] = useState<{ percent_off: number; final: number } | null>(null);

  const selected = getPlan(plan);
  const price = discount ? discount.final : selected.priceEur;

  async function applyCode() {
    if (code.trim().length < 3) return toast.error("Inserisci un codice valido");
    setChecking(true);
    try {
      const res = await preview({ data: { code: code.trim(), plan } });
      if (!res.valid) {
        setDiscount(null);
        toast.error(res.reason);
      } else {
        setDiscount({ percent_off: res.percent_off, final: res.final_price_eur });
        toast.success(
          res.final_price_eur === 0
            ? "Codice valido: abbonamento gratuito"
            : `Codice valido: -${res.percent_off}%`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore verifica codice");
    } finally {
      setChecking(false);
    }
  }

  async function handleActivate() {
    setLoading(true);
    try {
      const res = await activate({
        data: { plan, discount_code: discount ? code.trim() : undefined },
      });
      toast.success(res.message);
      await onActivated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore attivazione");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {PLANS.map((p) => {
          const active = p.id === plan;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPlan(p.id);
                setDiscount(null);
              }}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                active ? "border-cicla bg-cicla/10" : "border-border/60 bg-card"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">{p.name}</span>
                <span className="text-lg font-bold">{p.priceEur}€</span>
              </div>
              <div className="text-[11px] text-muted-foreground">al mese · {p.seatsLabel}</div>
              <ul className="mt-2 space-y-1">
                {p.highlights.map((h) => (
                  <li key={h} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Check className="size-3 text-cicla" /> {h}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <Card className="border-border/60 p-4">
        <Label htmlFor="discount" className="flex items-center gap-1.5 text-xs">
          <TicketPercent className="size-3.5" /> Codice sconto (partner / fase test)
        </Label>
        <div className="mt-2 flex gap-2">
          <Input
            id="discount"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setDiscount(null);
            }}
            placeholder="ES. PARTNER100"
            className="uppercase"
            maxLength={40}
          />
          <Button type="button" variant="outline" onClick={applyCode} disabled={checking}>
            {checking ? <Loader2 className="size-4 animate-spin" /> : "Applica"}
          </Button>
        </div>
        {discount && (
          <p className="mt-2 text-[12px] text-cicla">
            Sconto {discount.percent_off}% applicato · totale {discount.final.toFixed(2)}€/mese
          </p>
        )}
      </Card>

      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Totale</div>
          <div className="text-xl font-bold">
            {price.toFixed(2)}€ <span className="text-xs font-normal text-muted-foreground">/ mese</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {selected.name} · {selected.seatsLabel} {memberLabel}
          </div>
        </div>
        <Button onClick={handleActivate} disabled={loading} className="h-11">
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <CreditCard className="mr-2 size-4" />
              {price === 0 ? "Attiva gratis" : "Attiva abbonamento"}
            </>
          )}
        </Button>
      </div>
      {price > 0 && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Il pagamento con carta non è ancora attivo: senza codice sconto viene avviato un trial di
          14 giorni sul piano scelto.
        </p>
      )}
    </div>
  );
}
