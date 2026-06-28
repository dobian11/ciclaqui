import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMyCompany, updateTrackingWindow, listMyCompanyReviews } from "@/lib/companies.functions";
import { startCompanySubscription } from "@/lib/payments.functions";

import { listMyEmployees } from "@/lib/admin.functions";
import { CiclaLogo } from "@/components/cicla/CiclaLogo";
import { CompanyReviewDialog } from "@/components/cicla/CompanyReviewDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2, Copy, Check, Users, CreditCard, Share2, LogOut, Building2, Landmark, Mail, Hash, Download, Bike, Clock, RefreshCw, History, FileText,
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

  // Toast di stato approvazione (una volta per sessione, per stato)
  useEffect(() => {
    if (!company) return;
    const c = company as { id: string; status?: string; rejection_reason?: string | null };
    const status = c.status ?? "pending";
    const key = `cicla:company-status-toast:${c.id}:${status}`;
    if (typeof window === "undefined" || sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    if (status === "rejected") {
      toast.error("Richiesta rifiutata dall'admin", {
        description: c.rejection_reason
          ? `Motivo: ${c.rejection_reason}`
          : "Nessun motivo specificato. Contatta il supporto.",
        duration: 10000,
      });
    } else if (status === "pending") {
      toast.info("Registrazione in attesa di approvazione admin", {
        description: "Verifica entro 24–48h. Riceverai una notifica appena approvato.",
        duration: 7000,
      });
    } else if (status === "approved") {
      toast.success("Ente approvato dall'admin", {
        description: "Attiva l'abbonamento per generare il codice da distribuire.",
        duration: 6000,
      });
    }
  }, [company]);

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
  const status = (company as { status?: string }).status ?? "pending";
  const isApproved = status === "approved";
  const isRejected = status === "rejected";
  const canShowCode = isApproved && subActive;

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
          {!isApproved && (
            <Badge variant="secondary" className={isRejected ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}>
              {isRejected ? "Rifiutato" : "In attesa approvazione"}
            </Badge>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{company.name}</h1>

        {/* Stato approvazione */}
        {!isApproved && (
          <Card className={`mt-6 p-5 ${isRejected ? "border-destructive/40 bg-destructive/5" : "border-warning/40 bg-warning/5"}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">
                {isRejected ? "Registrazione rifiutata" : "In attesa di approvazione admin"}
              </div>
              <Badge variant="secondary" className={isRejected ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}>
                {isRejected ? "Rifiutato" : "In revisione"}
              </Badge>
            </div>
            {isRejected ? (
              <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-destructive">Motivo del rifiuto</div>
                <p className="mt-1 text-[12px] leading-snug">
                  {(company as { rejection_reason?: string | null }).rejection_reason?.trim() || "Nessun motivo specificato dall'admin."}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Aggiorna i tuoi dati ({isMuni ? "Comune" : "azienda"}, P.IVA/CF, email, IBAN) e contatta il supporto per richiedere una nuova revisione.
                </p>
              </div>
            ) : (
              <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                Abbiamo ricevuto i tuoi dati ({isMuni ? "Comune" : "azienda"}, P.IVA/CF, email). Un amministratore li verifica entro 24–48h. Una volta approvato potrai attivare l'abbonamento e generare il codice da distribuire ai tuoi {isMuni ? "cittadini" : "dipendenti"}.
              </p>
            )}
          </Card>
        )}

        {/* Codice — visibile solo dopo approvazione + abbonamento */}
        {canShowCode ? (
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
        ) : isApproved && !subActive ? (
          <Card className="mt-6 border-cicla/30 bg-cicla/5 p-5">
            <div className="text-sm font-semibold text-cicla">✓ Ente approvato</div>
            <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
              Per <strong>generare e ricevere il codice</strong> da distribuire ai tuoi {isMuni ? "cittadini" : "dipendenti"}, attiva l'abbonamento mensile qui sotto.
            </p>
          </Card>
        ) : null}

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

        {/* Abbonamento CTA — solo dopo approvazione */}
        {isApproved && !subActive && (
          <Card className="mt-4 border-warning/40 bg-warning/5 p-5">
            <div className="text-sm font-semibold">Attiva l'abbonamento per generare il codice</div>
            <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
              Per riconoscere i premi (denaro, voucher o altri incentivi) ai punti accumulati
              dai tuoi {isMuni ? "cittadini" : "dipendenti"} serve un abbonamento mensile.
              All'attivazione riceverai il <strong>codice ente</strong> da distribuire.
              Stripe non è ancora collegato: puoi avviare un <strong>trial 14 giorni</strong> per testare il pannello.
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

        {/* Dipendenti & tracking — solo quando il codice è attivo */}
        {canShowCode && (
          <>
            <EmployeesSection />
            <TrackingWindowSection
              initial={{
                tracking_start: company.tracking_start ?? null,
                tracking_end: company.tracking_end ?? null,
                tracking_days: (company.tracking_days as number[] | null) ?? [1,2,3,4,5],
              }}
              isMuni={isMuni}
            />
          </>
        )}

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

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

function TrackingWindowSection({
  initial,
  isMuni,
}: {
  initial: { tracking_start: string | null; tracking_end: string | null; tracking_days: number[] };
  isMuni: boolean;
}) {
  const qc = useQueryClient();
  const update = useServerFn(updateTrackingWindow);
  const [start, setStart] = useState(initial.tracking_start?.slice(0, 5) ?? "08:00");
  const [end, setEnd] = useState(initial.tracking_end?.slice(0, 5) ?? "19:00");
  const [days, setDays] = useState<number[]>(initial.tracking_days);
  const [alwaysOn, setAlwaysOn] = useState(!initial.tracking_start && !initial.tracking_end);
  const [saving, setSaving] = useState(false);

  const toggleDay = (d: number) =>
    setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort()));

  async function save() {
    setSaving(true);
    try {
      await update({
        data: {
          tracking_start: alwaysOn ? null : `${start}:00`,
          tracking_end: alwaysOn ? null : `${end}:00`,
          tracking_days: days,
        },
      });
      toast.success("Orario tracking aggiornato");
      qc.invalidateQueries({ queryKey: ["my-company"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-4 p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className="size-4" />
        <span className="text-[11px] font-semibold uppercase tracking-wider">
          Orario tracking {isMuni ? "cittadini" : "dipendenti"}
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
        I viaggi vengono registrati e premiati <strong>solo in questa finestra oraria</strong> e nei
        giorni selezionati (es. tragitto casa–lavoro). Fuori da qui il tracking è disattivato.
      </p>

      <label className="mt-3 flex items-center gap-2 text-[12px]">
        <input
          type="checkbox"
          checked={alwaysOn}
          onChange={(e) => setAlwaysOn(e.target.checked)}
          className="size-4 accent-cicla"
        />
        Tracking sempre attivo (24/7)
      </label>

      {!alwaysOn && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-[11px] font-medium text-muted-foreground">
            Inizio
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
            />
          </label>
          <label className="text-[11px] font-medium text-muted-foreground">
            Fine
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
            />
          </label>
        </div>
      )}

      <div className="mt-3">
        <div className="text-[11px] font-medium text-muted-foreground">Giorni attivi</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {DAY_LABELS.map((lbl, i) => {
            const active = days.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={`h-8 min-w-10 rounded-full px-2.5 text-[11px] font-semibold transition-colors ${
                  active
                    ? "bg-cicla text-cicla-foreground"
                    : "border border-border bg-background text-muted-foreground"
                }`}
              >
                {lbl}
              </button>
            );
          })}
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="mt-4 w-full">
        {saving ? <Loader2 className="size-4 animate-spin" /> : "Salva orario"}
      </Button>
    </Card>
  );
}

