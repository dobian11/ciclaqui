import { useMemo, useState } from "react";
import { Trophy, ChevronDown, Users } from "lucide-react";
import {
  challengeMatchesMode,
  estimateDelta,
  challengeUnit,
  type ChallengeLike,
} from "@/lib/challenge-match";

interface Props {
  challenges: ChallengeLike[] | undefined;
  mode: "bike" | "foot" | "car";
  recording: boolean;
  distanceKm: number;
}

/**
 * Mostra, durante (o prima di) un viaggio, per quali coppe/maratone
 * il tragitto in corso sta accumulando progressi.
 */
export function ActiveCupsBanner({ challenges, mode, recording, distanceKm }: Props) {
  const [open, setOpen] = useState(false);

  const matching = useMemo(
    () => (challenges ?? []).filter((c) => challengeMatchesMode(c.type, mode)),
    [challenges, mode],
  );

  if (matching.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 z-[1000] flex flex-col items-center px-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="pointer-events-auto inline-flex max-w-full items-center gap-1.5 rounded-full app-glass px-2.5 py-1 shadow-lg"
      >
        <Trophy size={11} className="shrink-0 text-cicla" />
        <span className="truncate text-[11px] font-semibold">
          {recording ? "Stai gareggiando per" : "Coppe attive"}
          {matching.length > 1 ? ` · ${matching.length}` : ""}
        </span>
        {matching.length === 1 && (
          <span className="hidden max-w-[40vw] truncate text-[10px] text-muted-foreground min-[360px]:inline">
            {matching[0].title}
          </span>
        )}
        <ChevronDown size={11} className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="pointer-events-auto mt-1.5 w-full max-w-sm space-y-1.5 rounded-2xl app-glass p-2.5 shadow-xl">
          {matching.map((c) => {
            const goal = Number(c.goal) || 0;
            const base = Number(c.is_team ? (c.team_progress ?? c.progress ?? 0) : (c.progress ?? 0));
            const delta = recording ? estimateDelta(c.type, distanceKm) : 0;
            const pct = goal > 0 ? Math.min(100, ((base + delta) / goal) * 100) : 0;
            return (
              <div key={c.id} className="rounded-xl border border-border/60 bg-background/50 p-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] leading-none">{c.icon || "🏆"}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">{c.title}</span>
                  {c.is_team && <Users size={10} className="shrink-0 text-muted-foreground" />}
                  {delta > 0 && (
                    <span className="shrink-0 rounded-full bg-cicla/15 px-1.5 text-[9px] font-bold text-cicla">
                      +{delta < 1 ? delta.toFixed(2) : delta.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-cicla transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-0.5 text-[9px] tabular-nums text-muted-foreground">
                  {(base + delta).toFixed(base + delta < 10 ? 1 : 0)} / {goal} {challengeUnit(c.type)}
                  {c.trophy_label ? ` · ${c.trophy_label}` : ""}
                </p>
              </div>
            );
          })}
          {mode === "car" && (
            <p className="text-[9px] text-muted-foreground">In auto non maturi progressi nelle coppe.</p>
          )}
        </div>
      )}
    </div>
  );
}
