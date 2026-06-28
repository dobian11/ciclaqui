import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMyCompany, updateTrackingWindow } from "@/lib/companies.functions";
import { startCompanySubscription } from "@/lib/payments.functions";

import { listMyEmployees } from "@/lib/admin.functions";
import { CiclaLogo } from "@/components/cicla/CiclaLogo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2, Copy, Check, Users, CreditCard, Share2, LogOut, Building2, Landmark, Mail, Hash, Download, Bike,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/azienda/")({
  ssr: false,
  component: CompanyDashboard,
});

function CompanyDashboard() {
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const getMine = useServerFn(getMyCompany);
  const startSub = useServerFn(startCompanySubscription);
  const [copied, setCopied] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
  }, []);

  const { data: company, isLoading } = useQuery({
    queryKey: ["my-company"],
    queryFn: () => getMine({}),
    enabled: hasSession === true,
    retry: false,
  });

  // Se non ha azienda → onboarding (solo se loggato)
  useEffect(() => {
    if (hasSession && !isLoading && !company) navigate({ to: "/azienda/onboarding" as never });
  }, [company, isLoading, hasSession, navigate]);

  async function copyCode() {
    if (!company) return;
    await navigator.clipboard.writeText(company.code);
    setCopied(true);
    toast.success("Codice copiato!");
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareInvite() {
    if (!company) return;
    const url = `${window.location.origin}/auth?mode=signup&code=${company.code}`;
    const payload = {
      title: "Iscriviti a Cicla Qui",
      text: `Unisciti a ${company.name} su Cicla Qui con il codice ${company.code}`,
      url,
    };
    if (navigator.share) {
      try { await navigator.share(payload); } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link invito copiato!");
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/" as never });
  }

  if (hasSession === false) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Anteprima pannello azienda — accedi per vedere i tuoi dati.</p>
          <Button onClick={() => navigate({ to: "/azienda/auth" as never })}>Accedi come azienda</Button>
        </div>
      </div>
    );
  }

  if (isLoading || !company) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const subStatus = company.subscription?.status ?? "inactive";
  const subActive = subStatus === "active" || subStatus === "trial";
  const isMuni = company.kind === "municipality";
  const memberLabel = isMuni ? "Cittadini" : "Dipendenti";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/40 to-background pb-12">
      <div className="mx-auto max-w-md px-5 py-6">
        <div className="flex items-center justify-between">
          <CiclaLogo size="md" />
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="size-4" />
          </Button>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <Badge variant="secondary" className="bg-cicla/10 text-cicla">
            {isMuni ? <Landmark className="mr-1 size-3" /> : <Building2 className="mr-1 size-3" />}
            Pannello {isMuni ? "Comune" : "azienda"}
          </Badge>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{company.name}</h1>

        {/* Codice */}
        <Card className="mt-6 border-cicla/30 bg-cicla/5 p-5 shadow-cicla">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-cicla">
            Codice {isMuni ? "Comune" : "azienda"}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="font-display text-3xl font-bold tracking-wider">{company.code}</div>
            <Button size="sm" variant="outline" onClick={copyCode}>
              {copied ? <Check className="size-4 text-cicla" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <p className="mt-3 text-[12px] leading-snug text-muted-foreground">
            Condividi questo codice con i tuoi {isMuni ? "cittadini" : "dipendenti"}: lo inseriranno
            in fase di registrazione per essere associati e ricevere i premi.
          </p>
          <Button onClick={shareInvite} className="mt-4 w-full" variant="secondary">
            <Share2 className="mr-2 size-4" /> Condividi invito
          </Button>
        </Card>

        {/* Statistiche */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="size-4" />
              <span className="text-[11px] uppercase tracking-wider">{memberLabel}</span>
            </div>
            <div className="mt-2 font-display text-2xl font-bold">{company.employees_count}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CreditCard className="size-4" />
              <span className="text-[11px] uppercase tracking-wider">Abbonamento</span>
            </div>
            <div className="mt-2 text-sm font-semibold">
              {subActive ? (
                <span className="text-cicla">Attivo</span>
              ) : (
                <span className="text-muted-foreground">Non attivo</span>
              )}
            </div>
          </Card>
        </div>

        {/* Abbonamento CTA */}
        {!subActive && (
          <Card className="mt-4 border-warning/40 bg-warning/5 p-5">
            <div className="text-sm font-semibold">Attiva l'abbonamento</div>
            <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
              Per riconoscere i premi (denaro, voucher o altri incentivi) ai punti accumulati
              dai tuoi {isMuni ? "cittadini" : "dipendenti"} serve un abbonamento mensile.
              Stripe non è ancora collegato: puoi avviare un <strong>trial 14 giorni</strong>
              {" "}per testare il pannello.
            </p>
            <Button
              className="mt-3 w-full"
              disabled={subLoading}
              onClick={async () => {
                setSubLoading(true);
                try {
                  const res = await startSub({});
                  toast.success(res.message);
                  await qc.invalidateQueries({ queryKey: ["my-company"] });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Errore");
                } finally {
                  setSubLoading(false);
                }
              }}
            >
              {subLoading ? <Loader2 className="size-4 animate-spin" /> : (
                <><CreditCard className="mr-2 size-4" /> Avvia trial (stub)</>
              )}
            </Button>
          </Card>
        )}

        {/* Dipendenti */}
        <EmployeesSection />

        {/* Dati azienda */}
        <Card className="mt-4 p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Dati aziendali
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <Row icon={<Hash className="size-3.5" />} label="P.IVA / CF" value={company.vat ?? "—"} />
            <Row icon={<Mail className="size-3.5" />} label="Email" value={company.contact_email ?? "—"} />
            <Row icon={<CreditCard className="size-3.5" />} label="IBAN" value={company.iban ?? "—"} />
          </dl>
        </Card>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2 last:border-0 last:pb-0">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[12px]">{label}</span>
      </div>
      <div className="truncate font-medium">{value}</div>
    </div>
  );
}

function EmployeesSection() {
  const list = useServerFn(listMyEmployees);
  const { data, isLoading } = useQuery({
    queryKey: ["my-employees"],
    queryFn: () => list({}),
    retry: false,
  });

  function exportCsv() {
    if (!data || data.length === 0) return;
    const header = ["Nome", "Iscritto il", "Viaggi", "Km totali", "Punti correnti", "Punti lifetime"];
    const rows = data.map((e) => [
      e.full_name,
      new Date(e.joined_at).toLocaleDateString("it-IT"),
      e.trips_count,
      e.total_km,
      e.points_balance,
      e.lifetime_points,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dipendenti-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV esportato");
  }

  return (
    <Card className="mt-4 p-5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Dipendenti
        </div>
        <Button size="sm" variant="ghost" onClick={exportCsv} disabled={!data?.length}>
          <Download className="mr-1 size-3.5" /> CSV
        </Button>
      </div>
      {isLoading ? (
        <div className="mt-4 flex justify-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.length === 0 ? (
        <p className="mt-3 text-[12px] text-muted-foreground">
          Nessun dipendente ancora iscritto. Condividi il codice azienda per invitarli.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border/40">
          {data.map((e) => (
            <li key={e.id} className="flex items-center justify-between py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{e.full_name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {e.trips_count} viaggi · {e.total_km} km
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-sm font-bold text-cicla">{e.points_balance} pt</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Bike className="mr-0.5 inline size-3" />lifetime {e.lifetime_points}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
