import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listMyTrips } from "@/lib/trips.functions";
import { Bike, Car, Coins, Footprints, TrendingUp, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/punti")({
  component: PuntiPage,
});

function PuntiPage() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
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

  const balance = walletQ.data;

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-md px-5 py-6 pb-32">
        <h1 className="text-2xl font-bold tracking-tight">Punti & saldo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          10 punti = 0,10 €. Bici 10 pt/km · piedi 3 pt/km · auto 0.
        </p>

        <div className="mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-cicla to-emerald-600 p-6 text-white shadow-cicla">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
            <Coins size={14} /> Saldo punti
          </div>
          <div className="mt-1 font-display text-5xl font-bold tabular-nums">
            {balance?.points_balance ?? 0}
          </div>
          <div className="mt-1 text-sm opacity-90">
            equivalente: € {(balance?.eur_balance ?? 0).toFixed(2)}
          </div>
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
              {(balance?.lifetime_km ?? 0).toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">totali</div>
          </div>
        </div>

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
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-2xl border bg-card p-3"
              >
                <div className={`grid size-10 place-items-center rounded-xl bg-muted ${color}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-sm font-bold tabular-nums">
                    {t.distance_km.toFixed(2)} km
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
                  <div className="font-display text-base font-bold text-cicla">
                    +{t.points_earned}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    punti
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
