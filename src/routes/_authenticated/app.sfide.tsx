import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listActiveChallenges,
  getMyStreak,
  getMyBadges,
  getCompanyLeaderboard,
} from "@/lib/gamification.functions";
import { Flame, Trophy, Award, Users, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/sfide")({
  component: SfidePage,
});

function SfidePage() {
  const listFn = useServerFn(listActiveChallenges);
  const streakFn = useServerFn(getMyStreak);
  const badgesFn = useServerFn(getMyBadges);
  const lbFn = useServerFn(getCompanyLeaderboard);

  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const enabled = authed === true;
  const ch = useQuery({ queryKey: ["challenges"], enabled, queryFn: () => listFn({} as any) });
  const st = useQuery({ queryKey: ["streak"], enabled, queryFn: () => streakFn({} as any) });
  const bd = useQuery({ queryKey: ["badges"], enabled, queryFn: () => badgesFn({} as any) });
  const lb = useQuery({ queryKey: ["leaderboard"], enabled, queryFn: () => lbFn({} as any) });

  if (authed === false) {
    return (
      <div className="app-page bg-background">
        <div className="app-container">
          <h1 className="font-display text-2xl font-black tracking-tight">Sfide & premi</h1>
          <div className="mt-6 rounded-3xl app-glass p-6 text-center text-sm text-muted-foreground shadow-xl">
            Accedi con il tuo codice azienda o Comune per vedere sfide, streak e classifica.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page bg-background">
      <div className="app-container">
        <h1 className="font-display text-2xl font-black tracking-tight">Sfide & premi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Completa obiettivi, mantieni la streak e scala la classifica del tuo ente.
        </p>

        {/* Streak */}
        <div className="mt-5 rounded-3xl app-glass p-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-warning/15 text-warning">
              <Flame size={22} strokeWidth={2.4} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Streak attuale
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl font-black tabular-nums leading-none">
                  {st.data?.current_days ?? 0}
                </span>
                <span className="text-xs text-muted-foreground">giorni</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Bonus
              </div>
              <div className="font-display text-lg font-bold text-cicla">
                ×{Number(st.data?.multiplier ?? 1).toFixed(2)}
              </div>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            Record personale: <strong className="text-foreground">{st.data?.best_days ?? 0}</strong> giorni
          </div>
        </div>

        {/* Sfide attive */}
        <h2 className="mt-6 mb-2 flex items-center gap-2 font-display text-lg font-bold">
          <Trophy size={18} className="text-cicla" /> Sfide attive
        </h2>
        {ch.isLoading ? (
          <div className="flex items-center gap-2 p-4 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> Carico…
          </div>
        ) : (ch.data ?? []).length === 0 ? (
          <div className="rounded-2xl app-glass p-4 text-sm text-muted-foreground">
            Nessuna sfida attiva al momento.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {(ch.data ?? []).map((c: any) => {
              const team = !!c.is_team;
              const value = team ? Number(c.team_progress ?? 0) : Number(c.progress);
              const pct = Math.min(100, Math.round((value / Number(c.goal)) * 100));
              const done = team ? pct >= 100 : !!c.completed_at;
              return (
                <div key={c.id} className="rounded-3xl app-glass p-4 shadow-lg">
                  <div className="flex items-start gap-3">
                    <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cicla/15 text-xl">
                      {c.icon ?? "🎯"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate font-display font-bold">{c.title}</h3>
                        <span className="shrink-0 rounded-full bg-cicla/15 px-2 py-0.5 text-[10px] font-bold text-cicla">
                          +{c.reward_points} pt
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {team ? "Coppa di squadra" : "Individuale"}
                        </span>
                        {c.trophy_label && (
                          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">
                            🏆 {c.trophy_label}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={`h-full ${done ? "bg-cicla" : "bg-cicla/70"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className="tabular-nums text-muted-foreground">
                      {value.toFixed(1)} / {Number(c.goal)}
                      {team ? ` · ${c.team_participants ?? 0} partecipanti` : ""}
                    </span>
                    <span className={done ? "font-bold text-cicla" : "text-muted-foreground"}>
                      {done ? "Completata ✓" : `${pct}%`}
                    </span>
                  </div>
                  {team && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      Il tuo contributo: {Number(c.progress).toFixed(1)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Classifica */}
        <h2 className="mt-6 mb-2 flex items-center gap-2 font-display text-lg font-bold">
          <Users size={18} className="text-cicla" /> Classifica ente
        </h2>
        {lb.isLoading ? (
          <div className="flex items-center gap-2 p-4 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> Carico…
          </div>
        ) : (lb.data ?? []).length === 0 ? (
          <div className="rounded-2xl app-glass p-4 text-sm text-muted-foreground">
            Nessun partecipante visibile. Iscriviti tramite il codice del tuo ente.
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl app-glass shadow-lg">
            {(lb.data ?? []).slice(0, 10).map((r: any, i: number) => (
              <div
                key={r.user_id}
                className="flex items-center gap-3 border-b border-white/5 px-4 py-2.5 last:border-0"
              >
                <div
                  className={`grid size-7 place-items-center rounded-full text-xs font-black ${
                    i === 0
                      ? "bg-warning text-background"
                      : i === 1
                      ? "bg-white/80 text-background"
                      : i === 2
                      ? "bg-orange-400/80 text-background"
                      : "bg-white/10 text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {r.full_name ?? "Anonimo"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {Number(r.lifetime_km).toFixed(1)} km · streak {r.current_streak}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-base font-bold tabular-nums">
                    {r.lifetime_points}
                  </div>
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
                    punti
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Badge */}
        <h2 className="mt-6 mb-2 flex items-center gap-2 font-display text-lg font-bold">
          <Award size={18} className="text-cicla" /> I tuoi badge
        </h2>
        {(bd.data ?? []).length === 0 ? (
          <div className="rounded-2xl app-glass p-4 text-sm text-muted-foreground">
            Completa una sfida per sbloccare il tuo primo badge.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {(bd.data ?? []).map((b: any) => (
              <div
                key={b.code}
                className="flex flex-col items-center rounded-2xl app-glass p-3 text-center shadow"
              >
                <span className="text-3xl">{b.icon ?? "🏅"}</span>
                <span className="mt-1 truncate text-[11px] font-bold">{b.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
