import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listMyTrips } from "@/lib/trips.functions";
import { listMyPayouts, requestPayout, getPayoutSummary } from "@/lib/payments.functions";
import {
  Bike,
  Car,
  Coins,
  Footprints,
  TrendingUp,
  Wallet,
  ArrowDownToLine,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { validateIban, formatIban } from "@/lib/iban";

export const Route = createFileRoute("/_authenticated/app/punti")({
  component: PuntiPage,
});

const STATUS_META: Record<string, { label: string; className: string; Icon: typeof Clock }> = {
  pending: { label: "In attesa", className: "bg-warning/15 text-warning", Icon: Clock },
  approved: { label: "Approvato", className: "bg-cicla/15 text-cicla", Icon: CheckCircle2 },
  paid: { label: "Pagato", className: "bg-cicla/20 text-cicla", Icon: CheckCircle2 },
  rejected: { label: "Rifiutato", className: "bg-destructive/15 text-destructive", Icon: XCircle },
};

function eur(n: number) {
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

function PuntiPage() {
  const [hasSession, setHasSession] = useState<boolean | null>(true);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
  }, []);

  const walletQ = useQuery({
    queryKey: ["wallet"],
    enabled: hasSession === true,
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("not signed in");
      const { data, error } = await supabase
        .from("wallets")
        .select("points_balance, eur_balance, lifetime_points, lifetime_km")
        .eq("user_id", user.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const fetchTrips = useServerFn(listMyTrips);
  const tripsQ = useQuery({
    queryKey: ["my-trips"],
    enabled: hasSession === true,
    queryFn: () => fetchTrips(),
  });

  const fetchPayouts = useServerFn(listMyPayouts);
  const payoutsQ = useQuery({
    queryKey: ["my-payouts"],
    enabled: hasSession === true,
    queryFn: () => fetchPayouts(),
  });

  const fetchSummary = useServerFn(getPayoutSummary);
  const summaryQ = useQuery({
    queryKey: ["payout-summary"],
    enabled: hasSession === true,
    queryFn: () => fetchSummary(),
  });

  const balance = walletQ.data;
  const summary = summaryQ.data;
  const points = summary?.points_balance ?? balance?.points_balance ?? 0;
  const minPoints = summary?.min_points ?? 50;
  const progress = Math.min(100, Math.round((points / Math.max(1, minPoints)) * 100));

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-md px-5 py-6 pb-32">
        <h1 className="text-2xl font-bold tracking-tight">Punti & premi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          I punti si trasformano in premi (denaro, voucher o incentivi) decisi dalla
          tua azienda o dal tuo Comune. Bici 10 pt/km · piedi 3 pt/km · auto 0.
        </p>

        <div className="mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-cicla to-emerald-600 p-6 text-white shadow-cicla">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
            <Coins size={14} /> Saldo punti
          </div>
          <div className="mt-1 font-display text-5xl font-bold tabular-nums">{points}</div>
          <div className="mt-1 text-sm opacity-90">punti riscattabili in premi</div>

          {summary && (
            <>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full rounded-full bg-white transition-all"
                  style={{ width: `${progress}%` }}
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progresso verso la soglia di prelievo"
                />
              </div>
              <div className="mt-1.5 text-[11px] opacity-85">
                {summary.missing_points > 0
                  ? `Mancano ${summary.missing_points} punti alla soglia di prelievo (${minPoints} pt)`
                  : `Convertibili ora: ${eur(summary.eur_available)}`}
              </div>
            </>
          )}

          <Button
            onClick={() => setOpen(true)}
            disabled={!hasSession || !summary?.can_request}
            className="mt-4 w-full bg-white text-cicla hover:bg-white/90"
          >
            <ArrowDownToLine size={16} className="mr-2" /> Converti in denaro
          </Button>
          {summary?.has_open_request && (
            <div className="mt-2 text-[11px] opacity-85">
              Hai già una richiesta in corso: attendi il completamento.
            </div>
          )}
          {summary && !summary.has_open_request && summary.missing_points > 0 && (
            <div className="mt-2 text-[11px] opacity-85">
              Servono almeno {minPoints} punti per richiedere il prelievo.
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              <TrendingUp size={12} /> Lifetime
            </div>
            <div className="mt-1 font-display text-2xl font-bold tabular-nums">
              {balance?.lifetime_points ?? 0}
            </div>
            <div className="text-xs text-muted-foreground">punti totali</div>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              <Wallet size={12} /> Incassato
            </div>
            <div className="mt-1 font-display text-2xl font-bold tabular-nums">
              {eur(summary?.paid_eur ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground">prelievi pagati</div>
          </div>
        </div>

        {payoutsQ.data && payoutsQ.data.length > 0 && (
          <>
            <h2 className="mt-8 text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Prelievi
            </h2>
            <div className="mt-3 space-y-2">
              {payoutsQ.data.map((p) => {
                const meta = STATUS_META[p.status] ?? STATUS_META['pending']!;
                return (
                  <div key={p.id} className="rounded-2xl border bg-card p-3">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-xl bg-muted text-cicla">
                        <meta.Icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-sm font-bold tabular-nums">
                          {eur(Number(p.amount_eur))}
                          <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                            −{p.points_redeemed} pt
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(p.created_at).toLocaleString("it-IT", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {p.iban_snapshot
                            ? ` · ${p.iban_snapshot.slice(0, 4)}…${p.iban_snapshot.slice(-4)}`
                            : ""}
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.className}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    {p.admin_notes && (
                      <p className="mt-2 rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
                        {p.admin_notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <h2 className="mt-8 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Ultimi viaggi
        </h2>
        <div className="mt-3 space-y-2">
          {hasSession === false && (
            <div className="rounded-2xl border border-dashed bg-muted/30 p-5 text-center text-sm text-muted-foreground">
              Accedi per vedere i tuoi viaggi.
            </div>
          )}
          {hasSession && tripsQ.isLoading && (
            <div className="rounded-2xl border bg-card/40 p-5 text-center text-sm text-muted-foreground">
              Carico…
            </div>
          )}
          {hasSession && tripsQ.data?.length === 0 && (
            <div className="rounded-2xl border border-dashed bg-muted/30 p-5 text-center text-sm text-muted-foreground">
              Nessun viaggio registrato. Premi <strong>Avvia viaggio</strong> sulla mappa.
            </div>
          )}
          {tripsQ.data?.map((t) => {
            const Icon = t.mode === "bike" ? Bike : t.mode === "foot" ? Footprints : Car;
            const color =
              t.mode === "bike" ? "text-cicla" : t.mode === "foot" ? "text-warning" : "text-destructive";
            return (
              <div key={t.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                <div className={`grid size-10 place-items-center rounded-xl bg-muted ${color}`}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-sm font-bold tabular-nums">
                    {Number(t.distance_km).toFixed(2)} km
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(t.started_at).toLocaleString("it-IT", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {t.anomaly_flag ? " · sospetto" : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-base font-bold text-cicla">+{t.points_earned}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">punti</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {open && summary && (
        <PayoutModal
          max={points}
          minPoints={minPoints}
          eurPerPoint={summary.eur_per_point}
          savedIbanMasked={summary.saved_iban_masked}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function PayoutModal({
  max,
  minPoints,
  eurPerPoint,
  savedIbanMasked,
  onClose,
}: {
  max: number;
  minPoints: number;
  eurPerPoint: number;
  savedIbanMasked: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const submit = useServerFn(requestPayout);
  const [points, setPoints] = useState(max);
  const [useSaved, setUseSaved] = useState(!!savedIbanMasked);
  const [iban, setIban] = useState("");
  const [loading, setLoading] = useState(false);

  const ibanCheck = useMemo(() => validateIban(iban), [iban]);
  const amount = Number((points * eurPerPoint).toFixed(2));
  const invalidPoints = points < minPoints || points > max;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (invalidPoints) {
      toast.error(`Inserisci tra ${minPoints} e ${max} punti`);
      return;
    }
    if (!useSaved && !ibanCheck.ok) {
      toast.error(`IBAN: ${ibanCheck.reason}`);
      return;
    }
    setLoading(true);
    try {
      const res = await submit({
        data: useSaved
          ? { points, use_saved_iban: true }
          : { points, iban: (ibanCheck as { ok: true; iban: string }).iban },
      });
      toast.success(`Richiesta inviata: ${eur(res.amount_eur)}`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["wallet"] }),
        qc.invalidateQueries({ queryKey: ["my-payouts"] }),
        qc.invalidateQueries({ queryKey: ["payout-summary"] }),
      ]);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  const quick = [minPoints, Math.floor(max / 2), max].filter(
    (v, i, arr) => v >= minPoints && v <= max && arr.indexOf(v) === i,
  );

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/60 backdrop-blur-sm sm:place-items-center"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border bg-card p-6 shadow-2xl sm:rounded-3xl"
      >
        <h3 className="font-display text-xl font-bold">Converti punti in denaro</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Disponibili <strong>{max} punti</strong> · minimo {minPoints} pt.
        </p>

        <div className="mt-4 rounded-2xl border bg-muted/30 p-4 text-center">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Riceverai
          </div>
          <div className="font-display text-3xl font-bold tabular-nums text-cicla">
            {eur(amount)}
          </div>
        </div>

        <label
          htmlFor="payout-points"
          className="mt-4 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Punti da convertire
        </label>
        <input
          id="payout-points"
          type="number"
          min={minPoints}
          max={max}
          step={1}
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          className="input-base mt-1.5 tabular-nums"
          aria-invalid={invalidPoints}
        />
        <input
          type="range"
          min={minPoints}
          max={max}
          step={1}
          value={Math.min(Math.max(points, minPoints), max)}
          onChange={(e) => setPoints(Number(e.target.value))}
          className="mt-3 w-full accent-cicla"
          aria-label="Seleziona i punti da convertire"
        />
        <div className="mt-2 flex gap-2">
          {quick.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setPoints(v)}
              className={`flex-1 rounded-xl border px-2 py-1.5 text-xs font-semibold transition ${
                points === v ? "border-cicla bg-cicla/10 text-cicla" : "text-muted-foreground"
              }`}
            >
              {v === max ? "Tutto" : `${v} pt`}
            </button>
          ))}
        </div>

        <div className="mt-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Accredito su IBAN
          </div>
          {savedIbanMasked && (
            <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xl border bg-muted/30 p-3 text-sm">
              <input
                type="checkbox"
                checked={useSaved}
                onChange={(e) => setUseSaved(e.target.checked)}
                className="size-4 accent-cicla"
              />
              <span className="font-mono">{savedIbanMasked}</span>
              <span className="text-xs text-muted-foreground">(salvato)</span>
            </label>
          )}
          {!useSaved && (
            <>
              <input
                type="text"
                value={iban}
                onChange={(e) => setIban(formatIban(e.target.value))}
                placeholder="IT60 X054 2811 1010 0000 0123 456"
                className={`input-base mt-2 font-mono ${
                  iban && !ibanCheck.ok ? "border-destructive" : ""
                }`}
                maxLength={42}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!iban && !ibanCheck.ok}
                aria-label="IBAN"
              />
              {iban && !ibanCheck.ok && (
                <p className="mt-1 text-[11px] text-destructive">⚠ {ibanCheck.reason}</p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                L'IBAN viene salvato nel profilo per i prelievi successivi.
              </p>
            </>
          )}
        </div>

        <p className="mt-4 rounded-xl border border-warning/40 bg-warning/5 p-2.5 text-[11px] text-warning-foreground">
          La richiesta resta <strong>in attesa</strong> finché non viene approvata e pagata.
          I punti vengono scalati subito e riaccreditati in caso di rifiuto.
        </p>

        <div className="mt-6 flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Annulla
          </Button>
          <Button type="submit" disabled={loading || invalidPoints} className="flex-1">
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Conferma"}
          </Button>
        </div>
      </form>
    </div>
  );
}
