import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listMyTrips } from "@/lib/trips.functions";
import { listMyPayouts, requestPayout } from "@/lib/payments.functions";
import { Bike, Car, Coins, Footprints, TrendingUp, Wallet, ArrowDownToLine, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { validateIban, formatIban } from "@/lib/iban";


export const Route = createFileRoute("/_authenticated/app/punti")({
  component: PuntiPage,
});

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

  const balance = walletQ.data;

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
          <div className="mt-1 font-display text-5xl font-bold tabular-nums">
            {balance?.points_balance ?? 0}
          </div>
          <div className="mt-1 text-sm opacity-90">
            punti riscattabili in premi
          </div>
          <Button
            onClick={() => setOpen(true)}
            disabled={!hasSession || (balance?.points_balance ?? 0) < 50}
            className="mt-4 w-full bg-white text-cicla hover:bg-white/90"
          >
            <ArrowDownToLine size={16} className="mr-2" /> Richiedi premio
          </Button>
          {hasSession && (balance?.points_balance ?? 0) < 50 && (
            <div className="mt-2 text-[11px] opacity-80">
              Servono almeno 50 punti per richiedere un premio.
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
              <Wallet size={12} /> Km percorsi
            </div>
            <div className="mt-1 font-display text-2xl font-bold tabular-nums">
              {Number(balance?.lifetime_km ?? 0).toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">totali</div>
          </div>
        </div>

        {payoutsQ.data && payoutsQ.data.length > 0 && (
          <>
            <h2 className="mt-8 text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Prelievi
            </h2>
            <div className="mt-3 space-y-2">
              {payoutsQ.data.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-muted text-cicla">
                    <ArrowDownToLine size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-sm font-bold tabular-nums">
                      € {Number(p.amount_eur).toFixed(2)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(p.created_at).toLocaleString("it-IT", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                      {" · "}{p.iban_snapshot?.slice(0, 4)}…{p.iban_snapshot?.slice(-4)}
                    </div>
                  </div>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider">
                    {p.status}
                  </span>
                </div>
              ))}
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
                <div className="flex-1 min-w-0">
                  <div className="font-display text-sm font-bold tabular-nums">
                    {Number(t.distance_km).toFixed(2)} km
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(t.started_at).toLocaleString("it-IT", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
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

      {open && (
        <PayoutModal
          max={balance?.points_balance ?? 0}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function PayoutModal({ max, onClose }: { max: number; onClose: () => void }) {
  const qc = useQueryClient();
  const submit = useServerFn(requestPayout);
  const [points, setPoints] = useState(Math.min(max, 100));
  const [iban, setIban] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const check = validateIban(iban);
    if (!check.ok) {
      toast.error(`IBAN: ${check.reason}`);
      return;
    }
    setLoading(true);
    try {
      const res = await submit({ data: { points, iban: check.iban } });
      toast.success(`Richiesta inviata: € ${res.amount_eur.toFixed(2)}`);
      await qc.invalidateQueries({ queryKey: ["wallet"] });
      await qc.invalidateQueries({ queryKey: ["my-payouts"] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 backdrop-blur-sm sm:place-items-center" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border bg-card p-6 shadow-2xl sm:rounded-3xl"
      >
        <h3 className="font-display text-xl font-bold">Preleva punti</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Conversione 10 pt = 0,10 €. Disponibili: <strong>{max} punti</strong>.
        </p>
        <p className="mt-2 rounded-xl border border-warning/40 bg-warning/5 p-2.5 text-[11px] text-warning-foreground">
          Stripe Connect in arrivo. Per ora la richiesta resta <strong>pending</strong>
          {" "}e verrà processata manualmente.
        </p>

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Punti da prelevare
        </label>
        <input
          type="number"
          min={50}
          max={max}
          step={10}
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          className="input-base mt-1.5"
        />
        <div className="mt-1 text-xs text-muted-foreground">
          = € {(points * 0.01).toFixed(2)}
        </div>

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          IBAN
        </label>
        <input
          type="text"
          value={iban}
          onChange={(e) => setIban(formatIban(e.target.value))}
          placeholder="IT60 X054 2811 1010 0000 0123 456"
          className={`input-base mt-1.5 font-mono ${
            iban && !validateIban(iban).ok ? "border-destructive" : ""
          }`}
          maxLength={42}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!iban && !validateIban(iban).ok}
          required
        />
        {iban && !validateIban(iban).ok && (
          <p className="mt-1 text-[11px] text-destructive">
            ⚠ {validateIban(iban).ok ? "" : (validateIban(iban) as { ok: false; reason: string }).reason}
          </p>
        )}


        <div className="mt-6 flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Annulla
          </Button>
          <Button type="submit" disabled={loading || points < 50 || points > max} className="flex-1">
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Conferma"}
          </Button>
        </div>
      </form>
    </div>
  );
}
