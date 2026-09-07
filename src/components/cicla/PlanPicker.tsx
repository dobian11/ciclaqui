import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PURCHASABLE_PLANS,
  PLANS,
  ENTERPRISE_CONTACT_EMAIL,
  getPlan,
  type PlanId,
} from "@/lib/plans";
import { PromoBanner } from "@/components/cicla/PromoBanner";
import { activateCompanySubscription, previewDiscountCode } from "@/lib/payments.functions";
import {
  getCompanySubscriptionState,
  scheduleCompanyPlanChange,
  cancelScheduledPlanChange,
  cancelCompanySubscription,
  resumeCompanySubscription,
  createBillingPortalSession,
} from "@/lib/subscriptions.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { SubscriptionCheckout } from "@/components/cicla/SubscriptionCheckout";
import { PaymentTestModeBanner } from "@/components/cicla/PaymentTestModeBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Check,
  CalendarClock,
  CreditCard,
  Loader2,
  Receipt,
  TicketPercent,
  X,
} from "lucide-react";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Abbonamento dell'ente: attivazione con pagamento reale e cambio piano con la
 * regola "il periodo già pagato si completa" (il nuovo piano parte alla
 * scadenza, anche se il cambio viene chiesto due giorni dopo l'acquisto).
 */
export function PlanPicker({
  memberLabel = "dipendenti",
  onActivated,
}: {
  memberLabel?: string;
  onActivated?: () => void | Promise<void>;
}) {
  const qc = useQueryClient();
  const activate = useServerFn(activateCompanySubscription);
  const preview = useServerFn(previewDiscountCode);
  const getState = useServerFn(getCompanySubscriptionState);
  const schedule = useServerFn(scheduleCompanyPlanChange);
  const cancelChange = useServerFn(cancelScheduledPlanChange);
  const cancelSub = useServerFn(cancelCompanySubscription);
  const resumeSub = useServerFn(resumeCompanySubscription);
  const portal = useServerFn(createBillingPortalSession);

  const [plan, setPlan] = useState<PlanId>("starter");
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [discount, setDiscount] = useState<{ percent_off: number; final: number } | null>(null);

  let environment: "sandbox" | "live" | null = null;
  try {
    environment = getStripeEnvironment();
  } catch {
    environment = null;
  }

  const { data: state, isLoading: stateLoading } = useQuery({
    queryKey: ["company-subscription", environment],
    queryFn: () => getState({ data: { environment: environment! } }),
    enabled: !!environment,
    retry: false,
  });

  const sub = state?.subscription ?? null;
  const selected = getPlan(plan);
  const price = discount ? discount.final : (selected.priceEur ?? 0);

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["company-subscription"] }),
      qc.invalidateQueries({ queryKey: ["my-company"] }),
    ]);
    await onActivated?.();
  }

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

  /** Codice 100%: attivazione gratuita. Altrimenti si paga davvero. */
  async function handleActivate() {
    if (price > 0) {
      if (!environment) {
        toast.error("Pagamenti non ancora disponibili in questa versione dell'app");
        return;
      }
      setPayOpen(true);
      return;
    }
    setLoading(true);
    try {
      const res = await activate({ data: { plan, discount_code: code.trim() } });
      toast.success(res.message);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore attivazione");
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePlan(next: PlanId) {
    if (!environment) return;
    setBusy(true);
    try {
      const res = await schedule({ data: { plan: next, environment } });
      if ("error" in res) throw new Error(res.error);
      toast.success(
        `Cambio piano programmato: parte il ${fmtDate(res.effective_at)}, alla fine del periodo già pagato.`,
      );
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore cambio piano");
    } finally {
      setBusy(false);
    }
  }

  async function run(
    fn: () => Promise<{ error?: string } & Record<string, unknown>>,
    okMsg: string,
  ) {
    setBusy(true);
    try {
      const res = await fn();
      if (res && "error" in res && res.error) throw new Error(String(res.error));
      toast.success(okMsg);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    if (!environment) return;
    setBusy(true);
    try {
      const res = await portal({
        data: { environment, returnUrl: `${window.location.origin}/azienda` },
      });
      if ("error" in res) throw new Error(res.error);
      window.open(res.url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(false);
    }
  }

  if (stateLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ---- Abbonamento pagato attivo: gestione piano ----
  if (sub?.is_paid) {
    const current = getPlan(sub.plan);
    return (
      <div className="space-y-4">
        <PaymentTestModeBanner />

        <Card className="border-cicla/40 bg-cicla/5 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Piano attivo
              </div>
              <div className="font-display text-xl font-bold">{current.name}</div>
              <div className="text-[12px] text-muted-foreground">
                {current.priceEur ? `${current.priceEur}€ al mese · ` : "Piano su misura · "}
                {current.seatsLabel} {memberLabel}
              </div>
            </div>
            <div className="text-right text-[12px] text-muted-foreground">
              {sub.cancel_at_period_end ? "Attivo fino al" : "Rinnovo il"}
              <div className="font-semibold text-foreground">
                {fmtDate(sub.current_period_end)}
              </div>
            </div>
          </div>

          {sub.pending_plan && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-border/60 bg-card p-3">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-cicla" />
              <div className="min-w-0 text-[12px]">
                <p className="font-semibold">
                  Passaggio a {getPlan(sub.pending_plan).name} il{" "}
                  {fmtDate(sub.pending_plan_effective_at)}
                </p>
                <p className="text-muted-foreground">
                  Fino a quella data resti sul piano {current.name}: il mese già pagato si
                  completa sempre.
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-1 h-7 px-2"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => cancelChange({ data: { environment: environment! } }) as never,
                      "Cambio piano annullato",
                    )
                  }
                >
                  <X className="mr-1 size-3.5" /> Annulla il cambio
                </Button>
              </div>
            </div>
          )}
        </Card>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Cambia piano
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Il nuovo piano parte alla scadenza del periodo già pagato ({fmtDate(sub.current_period_end)}):
            nessun rimborso e nessun addebito parziale.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {PURCHASABLE_PLANS.map((p) => {
              const isCurrent = p.id === sub.plan;
              const isPending = p.id === sub.pending_plan;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={isCurrent || isPending || busy}
                  onClick={() => handleChangePlan(p.id)}
                  className={`rounded-2xl border p-4 text-left transition-colors disabled:opacity-60 ${
                    isCurrent || isPending
                      ? "border-cicla bg-cicla/10"
                      : "border-border/60 bg-card hover:border-cicla/60"
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">{p.name}</span>
                    <span className="text-lg font-bold">{p.priceEur}€</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    al mese · {p.seatsLabel}
                  </div>
                  <div className="mt-2 text-[11px] font-semibold text-cicla">
                    {isCurrent ? "Piano attuale" : isPending ? "Programmato" : "Scegli"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openPortal} disabled={busy}>
            <Receipt className="mr-2 size-4" /> Fatture e metodo di pagamento
          </Button>
          {sub.cancel_at_period_end ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                run(
                  () => resumeSub({ data: { environment: environment! } }) as never,
                  "Abbonamento riattivato",
                )
              }
            >
              Riattiva il rinnovo
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={busy}
              onClick={() =>
                run(
                  () => cancelSub({ data: { environment: environment! } }) as never,
                  "Disdetta registrata: attivo fino a fine periodo",
                )
              }
            >
              Disdici a fine periodo
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ---- Nessun abbonamento pagato: scelta piano + pagamento ----
  if (payOpen) {
    return (
      <div className="space-y-3">
        <PaymentTestModeBanner />
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">
            {selected.name} ·{" "}
            {discount ? (
              <>
                <span className="line-through opacity-60">{selected.priceEur}€</span>{" "}
                {discount.final.toFixed(2)}€ al mese (-{discount.percent_off}%)
              </>
            ) : (
              <>{selected.priceEur}€ al mese</>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setPayOpen(false)}>
            Cambia piano
          </Button>
        </div>
        <SubscriptionCheckout plan={plan} discountCode={discount ? code.trim() : undefined} />
        <p className="text-[11px] leading-snug text-muted-foreground">
          L'abbonamento si rinnova ogni mese. Un cambio di piano richiesto durante il mese
          diventa effettivo solo alla scadenza del periodo già pagato.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PaymentTestModeBanner />
      <PromoBanner />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {PURCHASABLE_PLANS.map((p) => {
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
                  <li
                    key={h}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                  >
                    <Check className="size-3 text-cicla" /> {h}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}

        {PLANS.filter((p) => p.custom).map((p) => (
          <a
            key={p.id}
            href={`mailto:${ENTERPRISE_CONTACT_EMAIL}?subject=${encodeURIComponent("Richiesta piano Enterprise Cicla Qui")}`}
            className="rounded-2xl border border-dashed border-border/60 bg-card p-4 text-left transition-colors hover:border-cicla/60"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">{p.name}</span>
              <span className="text-xs font-semibold text-cicla">Su misura</span>
            </div>
            <div className="text-[11px] text-muted-foreground">{p.seatsLabel}</div>
            <ul className="mt-2 space-y-1">
              {p.highlights.map((h) => (
                <li
                  key={h}
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                >
                  <Check className="size-3 text-cicla" /> {h}
                </li>
              ))}
            </ul>
            <div className="mt-2 text-[11px] font-semibold text-cicla">
              Richiedi il tuo piano
            </div>
          </a>
        ))}
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
            {price.toFixed(2)}€{" "}
            <span className="text-xs font-normal text-muted-foreground">/ mese</span>
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
              {price === 0 ? "Attiva gratis" : "Vai al pagamento"}
            </>
          )}
        </Button>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Rinnovo mensile automatico. Se cambi piano durante il mese, il piano nuovo parte alla
        scadenza del mese già pagato; puoi disdire in qualsiasi momento e resti attivo fino a
        quella data.
      </p>
    </div>
  );
}
