import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listCompanyChallenges,
  upsertCompanyChallenge,
  deleteCompanyChallenge,
} from "@/lib/company-gamification.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trophy, Plus, Trash2, Loader2, Pencil, Users, User, Medal } from "lucide-react";
import { ChallengePodiumEditor } from "@/components/cicla/ChallengePodiumEditor";
import { confirmDialog as confirm } from "@/components/cicla/ConfirmDialog";

const TYPES = [
  { value: "km_bike", label: "Km in bici", unit: "km" },
  { value: "km_foot", label: "Km a piedi", unit: "km" },
  { value: "trip_count", label: "Numero viaggi", unit: "viaggi" },
  { value: "streak_days", label: "Giorni di streak", unit: "giorni" },
  { value: "co2_saved", label: "CO₂ risparmiata", unit: "kg" },
] as const;

const PERIODS = [
  { value: "weekly", label: "Settimanale" },
  { value: "monthly", label: "Mensile" },
  { value: "one_off", label: "Evento singolo" },
] as const;

type Draft = {
  id?: string;
  title: string;
  description: string;
  type: (typeof TYPES)[number]["value"];
  period: (typeof PERIODS)[number]["value"];
  is_team: boolean;
  trophy_label: string;
  goal: string;
  reward_points: string;
  icon: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

function isoDay(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const EMPTY: Draft = {
  title: "",
  description: "",
  type: "km_bike",
  period: "monthly",
  is_team: false,
  trophy_label: "",
  goal: "",
  reward_points: "100",
  icon: "🏆",
  starts_at: isoDay(),
  ends_at: isoDay(30),
  is_active: true,
};

export function CompanyChallengesSection({ memberLabel }: { memberLabel: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listCompanyChallenges);
  const upsert = useServerFn(upsertCompanyChallenge);
  const remove = useServerFn(deleteCompanyChallenge);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [podiumFor, setPodiumFor] = useState<string | null>(null);

  const { data: challenges, isLoading } = useQuery({
    queryKey: ["company-challenges"],
    queryFn: () => list({}),
    retry: false,
  });

  async function save() {
    if (!draft) return;
    const goal = Number(draft.goal);
    if (draft.title.trim().length < 2) return toast.error("Titolo troppo corto");
    if (!Number.isFinite(goal) || goal <= 0) return toast.error("Obiettivo non valido");
    if (draft.ends_at <= draft.starts_at) return toast.error("La data di fine deve essere successiva all'inizio");
    setSaving(true);
    try {
      await upsert({
        data: {
          id: draft.id,
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          type: draft.type,
          period: draft.period,
          is_team: draft.is_team,
          trophy_label: draft.trophy_label.trim() || null,
          goal,
          reward_points: Math.round(Number(draft.reward_points) || 0),
          icon: draft.icon || "🏆",
          starts_at: new Date(`${draft.starts_at}T00:00:00`).toISOString(),
          ends_at: new Date(`${draft.ends_at}T23:59:59`).toISOString(),
          is_active: draft.is_active,
        },
      });
      toast.success(draft.id ? "Coppa aggiornata" : "Coppa creata");
      setDraft(null);
      await qc.invalidateQueries({ queryKey: ["company-challenges"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    const c = await confirm({
      title: "Eliminare questa coppa?",
      description: "La competizione e i relativi progressi verranno rimossi.",
      confirmLabel: "Elimina",
      destructive: true,
    });
    if (!c.ok) return;
    try {
      await remove({ data: { id } });
      toast.success("Coppa eliminata");
      await qc.invalidateQueries({ queryKey: ["company-challenges"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
  }

  const unitOf = (t: string) => TYPES.find((x) => x.value === t)?.unit ?? "";

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Trophy className="size-4" /> Coppe & maratone
          </div>
          <Button size="sm" variant="outline" onClick={() => setDraft(draft ? null : { ...EMPTY })}>
            <Plus className="mr-1 size-3.5" /> {draft ? "Chiudi" : "Nuova coppa"}
          </Button>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Crea maratone <strong>individuali</strong> (classifica tra {memberLabel}) o{" "}
          <strong>di squadra</strong> (obiettivo unico dell'ente). Compaiono subito nella sezione
          Sfide dell'app dei ciclisti, con progressi e premio in punti.
        </p>

        {draft && (
          <div className="mt-4 grid gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="ch-title">Titolo</Label>
              <Input
                id="ch-title"
                value={draft.title}
                maxLength={120}
                placeholder="Maratona green di primavera"
                className="mt-1"
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="ch-desc">Descrizione</Label>
              <Input
                id="ch-desc"
                value={draft.description}
                maxLength={500}
                placeholder="Pedaliamo insieme fino a 1000 km"
                className="mt-1"
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>

            <div>
              <div className="text-[11px] font-medium text-muted-foreground">Modalità</div>
              <div className="mt-1.5 flex gap-1.5">
                {[
                  { v: false, label: "Individuale", Icon: User },
                  { v: true, label: "Squadra", Icon: Users },
                ].map(({ v, label, Icon }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setDraft({ ...draft, is_team: v })}
                    className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold transition-colors ${
                      draft.is_team === v
                        ? "bg-cicla text-cicla-foreground"
                        : "border border-border bg-background text-muted-foreground"
                    }`}
                  >
                    <Icon className="size-3.5" /> {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-medium text-muted-foreground">Periodo</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {PERIODS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setDraft({ ...draft, period: p.value })}
                    className={`h-8 rounded-full px-3 text-[11px] font-semibold transition-colors ${
                      draft.period === p.value
                        ? "bg-cicla text-cicla-foreground"
                        : "border border-border bg-background text-muted-foreground"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="text-[11px] font-medium text-muted-foreground">Obiettivo su</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setDraft({ ...draft, type: t.value })}
                    className={`h-8 rounded-full px-3 text-[11px] font-semibold transition-colors ${
                      draft.type === t.value
                        ? "bg-cicla text-cicla-foreground"
                        : "border border-border bg-background text-muted-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="ch-goal">Obiettivo ({unitOf(draft.type)})</Label>
              <Input
                id="ch-goal"
                type="number"
                inputMode="decimal"
                min={1}
                value={draft.goal}
                className="mt-1"
                placeholder={draft.is_team ? "1000" : "100"}
                onChange={(e) => setDraft({ ...draft, goal: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ch-points">Premio (punti)</Label>
              <Input
                id="ch-points"
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.reward_points}
                className="mt-1"
                onChange={(e) => setDraft({ ...draft, reward_points: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ch-start">Inizio</Label>
              <Input
                id="ch-start"
                type="date"
                value={draft.starts_at}
                className="mt-1"
                onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ch-end">Fine</Label>
              <Input
                id="ch-end"
                type="date"
                value={draft.ends_at}
                className="mt-1"
                onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ch-trophy">Nome trofeo (facolt.)</Label>
              <Input
                id="ch-trophy"
                value={draft.trophy_label}
                maxLength={80}
                placeholder="Coppa Cicla Qui 2026"
                className="mt-1"
                onChange={(e) => setDraft({ ...draft, trophy_label: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ch-icon">Icona (emoji)</Label>
              <Input
                id="ch-icon"
                value={draft.icon}
                maxLength={4}
                className="mt-1"
                onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
              />
            </div>

            <label className="flex items-center gap-2 text-[12px] md:col-span-2">
              <input
                type="checkbox"
                checked={draft.is_active}
                className="size-4 accent-cicla"
                onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
              />
              Attiva (visibile ai {memberLabel})
            </label>

            <Button onClick={save} disabled={saving} className="md:col-span-2">
              {saving ? <Loader2 className="size-4 animate-spin" /> : draft.id ? "Salva modifiche" : "Crea coppa"}
            </Button>
          </div>
        )}
      </Card>

      {isLoading ? (
        <div className="grid place-items-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : !challenges || challenges.length === 0 ? (
        <Card className="p-5 text-[13px] text-muted-foreground">
          Nessuna coppa creata. Lancia la prima maratona per motivare i tuoi {memberLabel}.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {challenges.map((c: any) => {
            const goal = Number(c.goal) || 1;
            const value = c.is_team ? Number(c.team_progress ?? 0) : Number(c.completed ?? 0);
            const pct = c.is_team ? Math.min(100, Math.round((value / goal) * 100)) : null;
            const ended = new Date(c.ends_at) < new Date();
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-cicla/10 text-lg">
                    {c.icon ?? "🏆"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{c.title}</span>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {c.is_team ? "squadra" : "individuale"}
                      </Badge>
                      {!c.is_active && (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">disattiva</Badge>
                      )}
                      {ended && (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">conclusa</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      Obiettivo {goal} {unitOf(c.type)} · +{c.reward_points} pt ·{" "}
                      {new Date(c.starts_at).toLocaleDateString("it-IT")} →{" "}
                      {new Date(c.ends_at).toLocaleDateString("it-IT")}
                    </div>
                    {c.trophy_label && (
                      <div className="mt-0.5 text-[11px] text-cicla">🏆 {c.trophy_label}</div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-7 p-0"
                      aria-label="Premi del podio"
                      onClick={() => setPodiumFor(podiumFor === c.id ? null : c.id)}
                    >
                      <Medal className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-7 p-0"
                      aria-label="Modifica coppa"
                      onClick={() =>
                        setDraft({
                          id: c.id,
                          title: c.title,
                          description: c.description ?? "",
                          type: c.type,
                          period: c.period,
                          is_team: !!c.is_team,
                          trophy_label: c.trophy_label ?? "",
                          goal: String(c.goal),
                          reward_points: String(c.reward_points),
                          icon: c.icon ?? "🏆",
                          starts_at: String(c.starts_at).slice(0, 10),
                          ends_at: String(c.ends_at).slice(0, 10),
                          is_active: c.is_active,
                        })
                      }
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-7 p-0 text-destructive"
                      aria-label="Elimina coppa"
                      onClick={() => del(c.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {c.is_team ? (
                  <>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-cicla" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                      <span className="tabular-nums">
                        {value.toFixed(1)} / {goal} {unitOf(c.type)}
                      </span>
                      <span>{pct}% · {c.participants} partecipanti</span>
                    </div>
                  </>
                ) : (
                  <div className="mt-3 text-[11px] text-muted-foreground">
                    {c.participants} partecipanti · {c.completed} completata/e
                  </div>
                )}

                {podiumFor === c.id && (
                  <ChallengePodiumEditor challengeId={c.id} unit={unitOf(c.type)} />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
