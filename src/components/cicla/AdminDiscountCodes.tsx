import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminListDiscountCodes,
  adminCreateDiscountCode,
  adminToggleDiscountCode,
} from "@/lib/admin.functions";
import { PLANS } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, TicketPercent } from "lucide-react";

/**
 * Gestione codici sconto: creazione di codici (di norma 100% per i partner in
 * fase di test) e attivazione/disattivazione.
 */
export function AdminDiscountCodes() {
  const qc = useQueryClient();
  const list = useServerFn(adminListDiscountCodes);
  const create = useServerFn(adminCreateDiscountCode);
  const toggle = useServerFn(adminToggleDiscountCode);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<string>("");

  const { data: codes, isLoading } = useQuery({
    queryKey: ["admin-discount-codes"],
    queryFn: () => list({}),
  });

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const code = String(fd.get("code") || "").trim();
    const label = String(fd.get("label") || "").trim();
    const percent = Number(fd.get("percent_off") || 100);
    const max = String(fd.get("max_redemptions") || "").trim();
    const expires = String(fd.get("expires_at") || "").trim();
    if (code.length < 3) return toast.error("Codice troppo corto");

    setSaving(true);
    try {
      await create({
        data: {
          code,
          label: label || undefined,
          percent_off: percent,
          plan: (plan || null) as never,
          max_redemptions: max ? Number(max) : null,
          expires_at: expires ? new Date(expires).toISOString() : null,
        },
      });
      toast.success("Codice sconto creato");
      form.reset();
      setPlan("");
      await qc.invalidateQueries({ queryKey: ["admin-discount-codes"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore creazione");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/60 p-5">
        <div className="flex items-center gap-2">
          <TicketPercent className="size-4 text-cicla" />
          <h2 className="text-sm font-semibold">Nuovo codice sconto</h2>
        </div>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Con sconto 100% l'ente attiva l'abbonamento a costo zero (aziende partner in fase di test).
        </p>
        <form onSubmit={handleCreate} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="code" className="text-xs">Codice *</Label>
            <Input id="code" name="code" required maxLength={40} placeholder="PARTNER100" className="uppercase" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="label" className="text-xs">Descrizione</Label>
            <Input id="label" name="label" maxLength={120} placeholder="Partner test 2026" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="percent_off" className="text-xs">Sconto %</Label>
            <Input id="percent_off" name="percent_off" type="number" min={1} max={100} defaultValue={100} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-select" className="text-xs">Piano</Label>
            <select
              id="plan-select"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Tutti i piani</option>
              {PLANS.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.priceEur}€</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="max_redemptions" className="text-xs">Usi massimi</Label>
            <Input id="max_redemptions" name="max_redemptions" type="number" min={1} placeholder="illimitati" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expires_at" className="text-xs">Scadenza</Label>
            <Input id="expires_at" name="expires_at" type="date" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={saving} className="h-11 w-full sm:w-auto">
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Crea codice"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="border-border/60 p-5">
        <h2 className="text-sm font-semibold">Codici esistenti</h2>
        {isLoading ? (
          <div className="grid place-items-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !codes || codes.length === 0 ? (
          <p className="mt-3 text-[12px] text-muted-foreground">Nessun codice sconto creato.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {codes.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{c.code}</span>
                    <Badge variant={c.active ? "default" : "secondary"}>
                      {c.active ? "attivo" : "disattivato"}
                    </Badge>
                    <Badge variant="outline">-{c.percent_off}%</Badge>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {c.label ? `${c.label} · ` : ""}
                    {c.plan ? `piano ${c.plan}` : "tutti i piani"} · usi {c.redeemed_count}
                    {c.max_redemptions ? `/${c.max_redemptions}` : ""}
                    {c.expires_at ? ` · scade ${new Date(c.expires_at).toLocaleDateString("it-IT")}` : ""}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={c.active ? "outline" : "default"}
                  onClick={async () => {
                    try {
                      await toggle({ data: { id: c.id, active: !c.active } });
                      await qc.invalidateQueries({ queryKey: ["admin-discount-codes"] });
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Errore");
                    }
                  }}
                >
                  {c.active ? "Disattiva" : "Attiva"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
