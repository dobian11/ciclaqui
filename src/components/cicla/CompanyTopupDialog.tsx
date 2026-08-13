import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createCompanyTopup } from "@/lib/company-wallet.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Landmark, CreditCard, Copy, Check } from "lucide-react";

const QUICK = [100, 250, 500, 1000];

type Bank = { beneficiary: string; iban: string; bic: string; bank: string };

/** Dialog di ricarica del conto ente: bonifico bancario o carta. */
export function CompanyTopupDialog({
  open,
  onOpenChange,
  bank,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bank: Bank;
}) {
  const qc = useQueryClient();
  const topup = useServerFn(createCompanyTopup);
  const [amount, setAmount] = useState<string>("250");
  const [method, setMethod] = useState<"bank_transfer" | "card">("bank_transfer");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [created, setCreated] = useState<{ reference: string; amount_eur: number } | null>(
    null,
  );

  const value = Number(amount.replace(",", "."));
  const valid = Number.isFinite(value) && value > 0;

  async function submit() {
    if (!valid) return;
    setLoading(true);
    try {
      const res = await topup({ data: { amount_eur: value, method } });
      setCreated({ reference: res.reference, amount_eur: res.amount_eur });
      qc.invalidateQueries({ queryKey: ["company-wallet"] });
      toast.success("Ricarica registrata", { description: res.message });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ricarica non riuscita");
    } finally {
      setLoading(false);
    }
  }

  function close(v: boolean) {
    onOpenChange(v);
    if (!v) setCreated(null);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ricarica conto ente</DialogTitle>
          <DialogDescription>
            Il saldo serve a pagare i prelievi dei tuoi iscritti con un click.
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-3">
            <div className="rounded-xl border bg-card/60 p-4 text-sm">
              <div className="font-semibold">
                Ricarica di € {created.amount_eur.toFixed(2)} registrata
              </div>
              <p className="mt-1 text-muted-foreground">
                {method === "card"
                  ? "Il pagamento con carta sarà disponibile a breve: nel frattempo la ricarica resta in attesa di conferma."
                  : "Esegui il bonifico con questa causale, il saldo viene accreditato alla ricezione."}
              </p>
            </div>
            <div className="space-y-1 rounded-xl border bg-card/60 p-4 text-sm">
              <Row label="Beneficiario" value={bank.beneficiary} />
              <Row label="IBAN" value={bank.iban} />
              <Row label="BIC" value={bank.bic} />
              <Row label="Causale" value={created.reference} />
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${bank.beneficiary} · ${bank.iban} · causale ${created.reference}`,
                );
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
              Copia dati bonifico
            </Button>
            <Button className="w-full" onClick={() => close(false)}>
              Chiudi
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <MethodButton
                active={method === "bank_transfer"}
                onClick={() => setMethod("bank_transfer")}
                icon={<Landmark className="size-4" />}
                label="Bonifico"
                hint="Accredito alla ricezione"
              />
              <MethodButton
                active={method === "card"}
                onClick={() => setMethod("card")}
                icon={<CreditCard className="size-4" />}
                label="Carta"
                hint="In attivazione"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="topup-amount">
                Importo (€)
              </label>
              <Input
                id="topup-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmount(String(q))}
                    className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold"
                  >
                    € {q}
                  </button>
                ))}
              </div>
            </div>

            <Button className="w-full" disabled={!valid || loading} onClick={submit}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Conferma ricarica
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MethodButton({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${
        active ? "border-cicla bg-cicla/10" : "border-border hover:bg-secondary"
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-semibold tabular-nums">{value}</span>
    </div>
  );
}
