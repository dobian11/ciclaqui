import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listCompanyRewards,
  upsertCompanyReward,
  deleteCompanyReward,
} from "@/lib/rewards.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Gift, Plus, Trash2, Loader2, Pencil } from "lucide-react";

import { REWARD_CATEGORIES } from "@/lib/reward-categories";

const CATEGORIES = REWARD_CATEGORIES.map((c) => ({
  value: c.value,
  label: `${c.emoji} ${c.label}`,
}));

type Draft = {
  id?: string;
  title: string;
  description: string;
  partner: string;
  category: (typeof REWARD_CATEGORIES)[number]["value"];
  points_cost: string;
  cash_value_eur: string;
  stock: string;
  terms: string;
  active: boolean;
};

const EMPTY: Draft = {
  title: "",
  description: "",
  partner: "",
  category: "voucher",
  points_cost: "",
  cash_value_eur: "",
  stock: "",
  terms: "",
  active: true,
};

export function CompanyRewardsSection() {
  const qc = useQueryClient();
  const list = useServerFn(listCompanyRewards);
  const upsert = useServerFn(upsertCompanyReward);
  const remove = useServerFn(deleteCompanyReward);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: rewards, isLoading } = useQuery({
    queryKey: ["company-rewards"],
    queryFn: () => list({}),
    retry: false,
  });

  async function save() {
    if (!draft) return;
    const points = Number(draft.points_cost);
    if (draft.title.trim().length < 2) return toast.error("Titolo troppo corto");
    if (!Number.isFinite(points) || points < 1) return toast.error("Costo in punti non valido");
    setSaving(true);
    try {
      await upsert({
        data: {
          id: draft.id,
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          partner: draft.partner.trim() || null,
          category: draft.category,
          points_cost: Math.round(points),
          cash_value_eur: draft.cash_value_eur ? Number(draft.cash_value_eur) : null,
          stock: draft.stock ? Math.round(Number(draft.stock)) : null,
          terms: draft.terms.trim() || null,
          active: draft.active,
        },
      });
      toast.success(draft.id ? "Premio aggiornato" : "Premio creato");
      setDraft(null);
      await qc.invalidateQueries({ queryKey: ["company-rewards"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!window.confirm("Eliminare questo premio?")) return;
    try {
      await remove({ data: { id } });
      toast.success("Premio eliminato");
      await qc.invalidateQueries({ queryKey: ["company-rewards"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
  }

  return (
    <Card className="mt-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Gift className="size-4" /> Catalogo premi del tuo ente
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[11px]"
          onClick={() => setDraft(draft ? null : { ...EMPTY })}
        >
          <Plus className="mr-1 size-3" /> {draft ? "Chiudi" : "Nuovo"}
        </Button>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        I premi che crei qui sono visibili solo ai membri del tuo ente, nella sezione Premi dell'app.
      </p>

      {draft && (
        <div className="mt-4 space-y-3 rounded-lg border border-border/60 bg-secondary/30 p-3">
          <div>
            <Label htmlFor="rw-title">Titolo</Label>
            <Input
              id="rw-title"
              value={draft.title}
              maxLength={120}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Buono mensa 10€"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="rw-desc">Descrizione</Label>
            <Input
              id="rw-desc"
              value={draft.description}
              maxLength={500}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Utilizzabile presso la mensa aziendale"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="rw-points">Costo (punti)</Label>
              <Input
                id="rw-points"
                type="number"
                inputMode="numeric"
                min={1}
                value={draft.points_cost}
                onChange={(e) => setDraft({ ...draft, points_cost: e.target.value })}
                placeholder="500"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="rw-value">Valore € (facolt.)</Label>
              <Input
                id="rw-value"
                type="number"
                inputMode="decimal"
                min={0}
                value={draft.cash_value_eur}
                onChange={(e) => setDraft({ ...draft, cash_value_eur: e.target.value })}
                placeholder="10"
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="rw-partner">Partner (facolt.)</Label>
              <Input
                id="rw-partner"
                value={draft.partner}
                maxLength={120}
                onChange={(e) => setDraft({ ...draft, partner: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="rw-stock">Disponibilità</Label>
              <Input
                id="rw-stock"
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.stock}
                onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
                placeholder="illimitata"
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-muted-foreground">Categoria</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setDraft({ ...draft, category: c.value })}
                  className={`h-8 rounded-full px-3 text-[11px] font-semibold transition-colors ${
                    draft.category === c.value
                      ? "bg-cicla text-cicla-foreground"
                      : "border border-border bg-background text-muted-foreground"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Attivo (visibile ai membri)
          </label>
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? <Loader2 className="size-4 animate-spin" /> : draft.id ? "Salva modifiche" : "Crea premio"}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="mt-4 grid place-items-center py-4">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : !rewards || rewards.length === 0 ? (
        <p className="mt-4 text-[12px] text-muted-foreground">Nessun premio creato.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rewards.map((r) => (
            <li key={r.id} className="rounded-lg border border-border/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{r.title}</span>
                    {!r.active && (
                      <Badge variant="secondary" className="text-[10px]">
                        disattivo
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {r.points_cost} pt
                    {r.cash_value_eur ? ` · valore € ${Number(r.cash_value_eur).toFixed(2)}` : ""}
                    {r.stock != null ? ` · ${r.stock} disponibili` : " · illimitato"}
                  </div>
                  {r.description && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{r.description}</div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="size-7 p-0"
                    aria-label="Modifica"
                    onClick={() =>
                      setDraft({
                        id: r.id,
                        title: r.title,
                        description: r.description ?? "",
                        partner: r.partner ?? "",
                        category: (CATEGORIES.find((c) => c.value === r.category)?.value ?? "voucher"),
                        points_cost: String(r.points_cost),
                        cash_value_eur: r.cash_value_eur != null ? String(r.cash_value_eur) : "",
                        stock: r.stock != null ? String(r.stock) : "",
                        terms: r.terms ?? "",
                        active: r.active,
                      })
                    }
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="size-7 p-0 text-destructive"
                    aria-label="Elimina"
                    onClick={() => del(r.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
