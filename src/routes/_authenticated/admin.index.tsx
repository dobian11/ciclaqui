import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  adminStats,
  adminListPayouts,
  adminDecidePayout,
  adminListPendingCompanies,
  adminDecideCompany,
  isAdmin,
} from "@/lib/admin.functions";
import { CiclaLogo } from "@/components/cicla/CiclaLogo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2, Users, Building2, Bike, Wallet, CreditCard, Shield, Check, X, Banknote,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  ssr: false,
  component: AdminDashboard,
});

function AdminDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const checkAdmin = useServerFn(isAdmin);
  const getStats = useServerFn(adminStats);
  const listPayouts = useServerFn(adminListPayouts);
  const decide = useServerFn(adminDecidePayout);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
  }, []);

  const { data: adminCheck, isLoading: checking } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => checkAdmin({}),
    enabled: hasSession === true,
    retry: false,
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => getStats({}),
    enabled: adminCheck?.admin === true,
  });

  const { data: payouts } = useQuery({
    queryKey: ["admin-payouts"],
    queryFn: () => listPayouts({}),
    enabled: adminCheck?.admin === true,
  });

  const listPendingCompanies = useServerFn(adminListPendingCompanies);
  const decideCompanyFn = useServerFn(adminDecideCompany);
  const { data: companies } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: () => listPendingCompanies({}),
    enabled: adminCheck?.admin === true,
  });

  async function handleDecide(id: string, decision: "approved" | "rejected" | "paid") {
    try {
      await decide({ data: { payout_id: id, decision } });
      toast.success(
        decision === "approved" ? "Approvato" : decision === "rejected" ? "Rifiutato (punti restituiti)" : "Segnato come pagato",
      );
      await qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      await qc.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
  }

  async function handleCompanyDecide(id: string, decision: "approved" | "rejected") {
    try {
      const reason = decision === "rejected"
        ? (window.prompt("Motivo del rifiuto (opzionale):") ?? undefined)
        : undefined;
      await decideCompanyFn({ data: { company_id: id, decision, reason } });
      toast.success(decision === "approved" ? "Ente approvato" : "Ente rifiutato");
      await qc.invalidateQueries({ queryKey: ["admin-companies"] });
      await qc.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
  }

  if (hasSession === false) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Accedi per usare il pannello admin.</p>
          <Button onClick={() => navigate({ to: "/auth" as never })}>Accedi</Button>
        </div>
      </div>
    );
  }

  if (checking || hasSession === null) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!adminCheck?.admin) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="space-y-3">
          <Shield className="mx-auto size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Accesso riservato agli amministratori.</p>
          <Button variant="outline" onClick={() => navigate({ to: "/" as never })}>
            Torna alla home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/40 to-background pb-12">
      <div className="mx-auto max-w-2xl px-5 py-6">
        <div className="flex items-center justify-between">
          <CiclaLogo size="md" />
          <Badge variant="secondary" className="bg-destructive/10 text-destructive">
            <Shield className="mr-1 size-3" /> Admin
          </Badge>
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight">Pannello amministratore</h1>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat icon={<Users className="size-4" />} label="Utenti" value={stats?.users} />
          <Stat icon={<Building2 className="size-4" />} label="Aziende" value={stats?.companies} />
          <Stat icon={<Bike className="size-4" />} label="Bici" value={stats?.bikes} />
          <Stat icon={<CreditCard className="size-4" />} label="Abb. attivi" value={stats?.active_subscriptions} />
          <Stat icon={<Wallet className="size-4" />} label="Prelievi pending" value={stats?.pending_payouts} highlight />
        </div>

        {/* Payouts */}
        <Card className="mt-6 p-5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Richieste di prelievo
            </div>
            <span className="text-[11px] text-muted-foreground">{payouts?.length ?? 0} totali</span>
          </div>

          {!payouts || payouts.length === 0 ? (
            <p className="mt-3 text-[12px] text-muted-foreground">Nessuna richiesta.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {payouts.map((p) => (
                <li key={p.id} className="rounded-lg border border-border/50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.user_name}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {p.points_redeemed} pt → € {Number(p.amount_eur).toFixed(2)}
                      </div>
                      {p.iban_snapshot && (
                        <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                          {p.iban_snapshot}
                        </div>
                      )}
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(p.created_at).toLocaleString("it-IT")}
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>

                  {p.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handleDecide(p.id, "approved")}>
                        <Check className="mr-1 size-3.5" /> Approva
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handleDecide(p.id, "rejected")}>
                        <X className="mr-1 size-3.5" /> Rifiuta
                      </Button>
                    </div>
                  )}
                  {p.status === "approved" && (
                    <Button size="sm" className="mt-3 w-full" onClick={() => handleDecide(p.id, "paid")}>
                      <Banknote className="mr-1 size-3.5" /> Segna come pagato
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  highlight?: boolean;
}) {
  return (
    <Card className={`p-4 ${highlight ? "border-warning/40 bg-warning/5" : ""}`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 font-display text-2xl font-bold">{value ?? "—"}</div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-warning/10 text-warning",
    approved: "bg-cicla/10 text-cicla",
    paid: "bg-cicla/20 text-cicla",
    rejected: "bg-destructive/10 text-destructive",
  };
  return (
    <Badge variant="secondary" className={map[status] ?? ""}>
      {status}
    </Badge>
  );
}
