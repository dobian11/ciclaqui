import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getChallengePodium,
  saveChallengePodium,
  awardChallengePodium,
} from "@/lib/company-gamification.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Medal } from "lucide-react";
import { rewardCategoryMeta } from "@/lib/reward-categories";

type PrizeDraft = {
  position: number;
  enabled: boolean;
  points: string;
  reward_id: string;
  label: string;
  awarded_at: string | null;
  awarded_name: string | null;
  awarded_code: string | null;
};

const MEDALS = ["🥇", "🥈", "🥉"];

function emptyDrafts(): PrizeDraft[] {
  return [1, 2, 3].map((position) => ({
    position,
    enabled: false,
    points: "",
    reward_id: "",
    label: "",
    awarded_at: null,
    awarded_name: null,
    awarded_code: null,
  }));
}

export function ChallengePodiumEditor({
  challengeId,
  unit,
}: {
  challengeId: string;
  unit: string;
}) {
  const qc = useQueryClient();
  const load = useServerFn(getChallengePodium);
  const save = useServerFn(saveChallengePodium);
  const award = useServerFn(awardChallengePodium);

  const [drafts, setDrafts] = useState<PrizeDraft[]>(emptyDrafts);
  const [saving, setSaving] = useState(false);
  const [awarding, setAwarding] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["challenge-podium", challengeId],
    queryFn: () => load({ data: { challengeId } }),
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    const next = emptyDrafts();
    for (const p of data.prizes as any[]) {
      const d = next[p.rank_position - 1];
      if (!d) continue;
      d.enabled = true;
      d.points = String(p.points ?? 0);
      d.reward_id = p.reward_id ?? "";
      d.label = p.label ?? "";
      d.awarded_at = p.awarded_at ?? null;
      d.awarded_name = p.awarded_name ?? null;
      d.awarded_code = p.awarded_code ?? null;
    }
    setDrafts(next);
  }, [data]);

  const rewards = (data?.rewards ?? []) as Array<{ id: string; title: string; category: string }>;
  const standings = (data?.standings ?? []) as Array<{
    rank: number;
    full_name: string;
    progress: number;
  }>;
  const anyAwarded = drafts.some((d) => d.awarded_at);

  function patch(i: number, changes: Partial<PrizeDraft>) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...changes } : d)));
  }

  async function onSave() {
    setSaving(true);
    try {
      await save({
        data: {
          challengeId,
          prizes: drafts
            .filter((d) => d.enabled)
            .map((d) => ({
              position: d.position,
              points: Math.max(0, Math.round(Number(d.points) || 0)),
              reward_id: d.reward_id || null,
              label: d.label.trim() || null,
            })),
        },
      });
      toast.success("Premi del podio salvati");
      await qc.invalidateQueries({ queryKey: ["challenge-podium", challengeId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }

  async function onAward() {
    if (!window.confirm("Assegnare i premi ai primi classificati? L'operazione non è reversibile."))
      return;
    setAwarding(true);
    try {
      const res = await award({ data: { challengeId } });
      const n = (res.awarded ?? []).length;
      toast.success(n ? `Podio assegnato a ${n} partecipante/i` : "Nessun premio da assegnare");
      await qc.invalidateQueries({ queryKey: ["challenge-podium", challengeId] });
      await qc.invalidateQueries({ queryKey: ["company-challenges"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore assegnazione");
    } finally {
      setAwarding(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mt-3 grid place-items-center rounded-lg border border-border/60 bg-secondary/30 py-4">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border/60 bg-secondary/30 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Medal className="size-3.5" /> Premi del podio
      </div>

      {drafts.map((d, i) => (
        <div key={d.position} className="rounded-lg border border-border/50 bg-background/60 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-[12px] font-semibold">
              <input
                type="checkbox"
                className="size-4 accent-cicla"
                checked={d.enabled}
                disabled={!!d.awarded_at}
                onChange={(e) => patch(i, { enabled: e.target.checked })}
              />
              {MEDALS[i]} {d.position}° classificato
            </label>
            {d.awarded_at && (
              <Badge variant="secondary" className="text-[10px]">
                assegnato a {d.awarded_name}
              </Badge>
            )}
          </div>

          {d.enabled && (
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <div>
                <Label htmlFor={`p-pts-${d.position}`} className="text-[11px]">
                  Punti bonus
                </Label>
                <Input
                  id={`p-pts-${d.position}`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="mt-1"
                  value={d.points}
                  disabled={!!d.awarded_at}
                  onChange={(e) => patch(i, { points: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={`p-rew-${d.position}`} className="text-[11px]">
                  Premio del catalogo
                </Label>
                <select
                  id={`p-rew-${d.position}`}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-[12px]"
                  value={d.reward_id}
                  disabled={!!d.awarded_at}
                  onChange={(e) => patch(i, { reward_id: e.target.value })}
                >
                  <option value="">Nessuno</option>
                  {rewards.map((r) => (
                    <option key={r.id} value={r.id}>
                      {rewardCategoryMeta(r.category).emoji} {r.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor={`p-lab-${d.position}`} className="text-[11px]">
                  Descrizione premio
                </Label>
                <Input
                  id={`p-lab-${d.position}`}
                  className="mt-1"
                  maxLength={160}
                  placeholder="Tagliando bici gratuito"
                  value={d.label}
                  disabled={!!d.awarded_at}
                  onChange={(e) => patch(i, { label: e.target.value })}
                />
              </div>
              {d.awarded_code && (
                <div className="text-[11px] text-muted-foreground md:col-span-3">
                  Codice consegnato: <strong className="text-foreground">{d.awarded_code}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Salva premi"}
        </Button>
        <Button size="sm" variant="outline" onClick={onAward} disabled={awarding}>
          {awarding ? <Loader2 className="size-3.5 animate-spin" /> : "Assegna podio"}
        </Button>
      </div>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Classifica attuale
        </div>
        {standings.length === 0 ? (
          <p className="mt-1 text-[12px] text-muted-foreground">Ancora nessun partecipante.</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {standings.slice(0, 5).map((s) => (
              <li key={s.rank} className="flex justify-between text-[12px]">
                <span>
                  {s.rank}. {s.full_name}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {s.progress.toFixed(1)} {unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {anyAwarded && (
        <p className="text-[11px] text-muted-foreground">
          Le posizioni già assegnate non sono più modificabili.
        </p>
      )}
    </div>
  );
}
