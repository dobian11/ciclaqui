import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Coins, TrendingUp, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/punti")({
  component: PuntiPage,
});

function PuntiPage() {
  const walletQ = useQuery({
    queryKey: ["wallet"],
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

  const balance = walletQ.data;

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-md px-5 py-6">
        <h1 className="text-2xl font-bold tracking-tight">Punti & saldo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          10 punti = 0,10 €. Prelevabili dallo Sprint 4.
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

        <div className="mt-8 rounded-2xl border border-dashed bg-muted/30 p-5 text-center">
          <p className="text-sm text-muted-foreground">
            Il tracker viaggi arriva nello <strong>Sprint 2</strong>. Da quel momento ogni
            chilometro in bici ti darà punti reali.
          </p>
        </div>
      </div>
    </div>
  );
}
