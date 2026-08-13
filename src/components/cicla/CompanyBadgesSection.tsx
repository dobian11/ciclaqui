import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMonthlyTopMembers,
  listCompanyBadges,
  awardCompanyBadge,
  revokeCompanyBadge,
} from "@/lib/company-gamification.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Award, Loader2, Crown, Trash2, Medal } from "lucide-react";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function CompanyBadgesSection({ memberLabel }: { memberLabel: string }) {
  const qc = useQueryClient();
  const topFn = useServerFn(getMonthlyTopMembers);
  const listFn = useServerFn(listCompanyBadges);
  const awardFn = useServerFn(awardCompanyBadge);
  const revokeFn = useServerFn(revokeCompanyBadge);

  const [month, setMonth] = useState(currentMonth());
  const [awarding, setAwarding] = useState<string | null>(null);
  const [custom, setCustom] = useState({ userId: "", title: "", description: "", icon: "🥇" });

  const top = useQuery({
    queryKey: ["company-top", month],
    queryFn: () => topFn({ data: { month } }),
    retry: false,
  });
  const badges = useQuery({
    queryKey: ["company-badges"],
    queryFn: () => listFn({}),
    retry: false,
  });

  const monthLabel = useMemo(
    () =>
      new Date(`${month}-01T00:00:00Z`).toLocaleDateString("it-IT", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
    [month],
  );

  async function award(userId: string, title: string, description: string, code: string, icon: string) {
    setAwarding(userId);
    try {
      await awardFn({ data: { userId, code, title, description, icon } });
      toast.success("Badge assegnato");
      await qc.invalidateQueries({ queryKey: ["company-badges"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setAwarding(null);
    }
  }

  async function revoke(id: string) {
    if (!window.confirm("Rimuovere questo badge?")) return;
    try {
      await revokeFn({ data: { id } });
      toast.success("Badge rimosso");
      await qc.invalidateQueries({ queryKey: ["company-badges"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
  }

  const rows = top.data?.rows ?? [];
  const winner = rows[0];

  return (
    <div className="space-y-4">
      {/* Dipendente del mese */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Crown className="size-4" /> Proposta {memberLabel === "cittadini" ? "cittadino" : "dipendente"} del mese
          </div>
          <Input
            type="month"
            value={month}
            max={currentMonth()}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
            className="h-8 w-40 text-[12px]"
            aria-label="Mese di riferimento"
          />
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Classifica automatica sui km in bici di <strong>{monthLabel}</strong>. Il sistema propone,
          tu confermi: il badge arriva nel profilo del ciclista con una notifica.
        </p>

        {top.isLoading ? (
          <div className="mt-4 grid place-items-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-[12px] text-muted-foreground">Nessun viaggio registrato in questo mese.</p>
        ) : (
          <>
            {winner && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-cicla/30 bg-cicla/5 p-4">
                <div className="grid size-11 place-items-center rounded-2xl bg-cicla/15 text-xl">🥇</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{winner.full_name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {winner.km_bike} km in bici · {winner.km_foot} km a piedi · {winner.co2_saved_kg} kg CO₂
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={awarding === winner.user_id}
                  onClick={() =>
                    award(
                      winner.user_id,
                      `${memberLabel === "cittadini" ? "Cittadino" : "Dipendente"} del mese — ${monthLabel}`,
                      `${winner.km_bike} km in bici in ${monthLabel}`,
                      `member_of_month_${month}`,
                      "🥇",
                    )
                  }
                >
                  {awarding === winner.user_id ? <Loader2 className="size-4 animate-spin" /> : "Conferma e assegna"}
                </Button>
              </div>
            )}

            <ul className="mt-3 divide-y divide-border/40">
              {rows.map((r: any, i: number) => (
                <li key={r.user_id} className="flex items-center gap-3 py-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-bold">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{r.full_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.km_bike} km bici · {r.trips} viaggi · {r.points} pt
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px]"
                    disabled={awarding === r.user_id}
                    onClick={() =>
                      award(
                        r.user_id,
                        `Menzione green — ${monthLabel}`,
                        `${r.km_bike} km in bici in ${monthLabel}`,
                        `green_mention_${month}`,
                        "🌿",
                      )
                    }
                  >
                    <Medal className="mr-1 size-3.5" /> Premia
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {/* Badge personalizzato */}
      <Card className="p-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Award className="size-4" /> Badge personalizzato
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label htmlFor="bd-user">Destinatario</Label>
            <select
              id="bd-user"
              value={custom.userId}
              onChange={(e) => setCustom({ ...custom, userId: e.target.value })}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">Seleziona…</option>
              {rows.map((r: any) => (
                <option key={r.user_id} value={r.user_id}>
                  {r.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="bd-title">Titolo badge</Label>
            <Input
              id="bd-title"
              value={custom.title}
              maxLength={120}
              placeholder="Pioniere della bici"
              className="mt-1"
              onChange={(e) => setCustom({ ...custom, title: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="bd-icon">Icona</Label>
            <Input
              id="bd-icon"
              value={custom.icon}
              maxLength={4}
              className="mt-1"
              onChange={(e) => setCustom({ ...custom, icon: e.target.value })}
            />
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="bd-desc">Motivazione</Label>
            <Input
              id="bd-desc"
              value={custom.description}
              maxLength={300}
              placeholder="Per aver promosso la mobilità sostenibile in ufficio"
              className="mt-1"
              onChange={(e) => setCustom({ ...custom, description: e.target.value })}
            />
          </div>
          <Button
            className="self-end"
            disabled={!custom.userId || custom.title.trim().length < 2 || awarding === custom.userId}
            onClick={async () => {
              await award(
                custom.userId,
                custom.title.trim(),
                custom.description.trim(),
                `custom_${Date.now()}`,
                custom.icon || "🏅",
              );
              setCustom({ userId: "", title: "", description: "", icon: "🥇" });
            }}
          >
            Assegna badge
          </Button>
        </div>
      </Card>

      {/* Storico badge */}
      <Card className="p-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Award className="size-4" /> Badge assegnati
        </div>
        {badges.isLoading ? (
          <div className="mt-4 grid place-items-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : !badges.data || badges.data.length === 0 ? (
          <p className="mt-3 text-[12px] text-muted-foreground">Nessun badge assegnato finora.</p>
        ) : (
          <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {badges.data.map((b: any) => (
              <li key={b.id} className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cicla/10 text-lg">
                  {b.icon ?? "🏅"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{b.title}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {b.full_name} · {new Date(b.earned_at).toLocaleDateString("it-IT")}
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px]">ente</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="size-7 shrink-0 p-0 text-destructive"
                  aria-label="Rimuovi badge"
                  onClick={() => revoke(b.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
