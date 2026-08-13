import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { emailLinkOrigin } from "@/lib/public-url";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMyCompany, updateTrackingWindow, listMyCompanyReviews } from "@/lib/companies.functions";

import { listMyEmployees } from "@/lib/admin.functions";
import { PlanPicker } from "@/components/cicla/PlanPicker";
import { CiclaLogo } from "@/components/cicla/CiclaLogo";
import { CompanyReviewDialog } from "@/components/cicla/CompanyReviewDialog";
import { PendingCompanyDashboard } from "@/components/cicla/PendingCompanyDashboard";
import { CompanyRejectionSection } from "@/components/cicla/CompanyRejectionSection";
import { CompanyAccessStatus } from "@/components/cicla/CompanyAccessStatus";
import { CompanyRewardsSection } from "@/components/cicla/CompanyRewardsSection";
import { CompanyChallengesSection } from "@/components/cicla/CompanyChallengesSection";
import { CompanyBadgesSection } from "@/components/cicla/CompanyBadgesSection";
import { CompanyShell, type CompanySection } from "@/components/cicla/CompanyShell";
import { NotificationsBell } from "@/components/cicla/NotificationsBell";
import { EmailLogSection } from "@/components/cicla/EmailLogSection";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2, Copy, Check, Users, CreditCard, Share2, LogOut, Building2, Landmark, Mail, Hash, Download, Bike, Clock,
  LayoutDashboard, Trophy, Award, Gift,
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
  const listReviews = useServerFn(listMyCompanyReviews);
  const [copied, setCopied] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [section, setSection] = useState("panoramica");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
  }, []);

  const { data: company, isLoading } = useQuery({
    queryKey: ["my-company"],
    queryFn: () => getMine({}),
    enabled: hasSession === true,
    retry: false,
  });

  const { data: reviews } = useQuery({
    queryKey: ["my-company-reviews"],
    queryFn: () => listReviews({}),
    enabled: hasSession === true && !!company,
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
    const url = `${emailLinkOrigin()}/auth?mode=signup&code=${company.code}`;
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
  const canShowCode = isApproved && subActive;

  // ---- Dashboard dedicata agli enti non ancora approvati ----
  if (!isApproved) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-secondary/40 to-background pb-12">
        <div className="mx-auto max-w-md px-5 py-6">
          <div className="flex items-center justify-between">
            <CiclaLogo size="md" />
            <div className="flex items-center gap-2">
              <NotificationsBell />
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>

          <CompanyAccessStatus
            status={status}
            subActive={subActive}
            rejectionReason={(company as { rejection_reason?: string | null }).rejection_reason}
            isMuni={isMuni}
          />


          <div className="mt-6">
            <PendingCompanyDashboard
              company={company as never}
              reviews={reviews as never}
              onRequestReview={() => setReviewOpen(true)}
            />
          </div>

          <CompanyRejectionSection
            companyRejectionReason={(company as { rejection_reason?: string | null }).rejection_reason}
            reviews={reviews as never}
            onRequestReview={() => setReviewOpen(true)}
          />


          <EmailLogSection companyId={company.id} title="Email di esito verifica" />

          <CompanyReviewDialog
            companyId={company.id}
            open={reviewOpen}
            onOpenChange={setReviewOpen}
          />
        </div>
      </div>
    );
  }

  const sections: CompanySection[] = [
    { id: "panoramica", label: "Panoramica", icon: LayoutDashboard },
    { id: "membri", label: memberLabel, icon: Users, count: company.employees_count },
    { id: "coppe", label: "Coppe & maratone", icon: Trophy },
    { id: "badge", label: "Badge", icon: Award },
    { id: "premi", label: "Premi", icon: Gift },
    { id: "abbonamento", label: "Abbonamento", icon: CreditCard },
  ];

  return (
    <CompanyShell
      title={company.name}
      subtitle={`Pannello ${isMuni ? "Comune" : "azienda"} · ${company.employees_count} ${memberLabel.toLowerCase()}`}
      isMuni={isMuni}
      sections={sections}
      activeSection={section}
      onSectionChange={setSection}
      actions={
        <Badge variant="secondary" className={subActive ? "bg-cicla/10 text-cicla" : "bg-warning/15 text-warning"}>
          {subActive ? "Abbonamento attivo" : "Abbonamento non attivo"}
        </Badge>
      }
    >
      {section === "panoramica" && (
        <div className="space-y-4">
          <CompanyAccessStatus
            status={status}
            subActive={subActive}
            rejectionReason={(company as { rejection_reason?: string | null }).rejection_reason}
            isMuni={isMuni}
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                {subActive ? <span className="text-cicla">Attivo</span> : <span className="text-muted-foreground">Non attivo</span>}
              </div>
            </Card>
            <Card className="p-4 sm:col-span-2">
              {canShowCode ? (
                <>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-cicla">
                    Codice {isMuni ? "Comune" : "azienda"}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="font-display text-3xl font-bold tracking-wider">{company.code}</div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={copyCode} aria-label="Copia codice">
                        {copied ? <Check className="size-4 text-cicla" /> : <Copy className="size-4" />}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={shareInvite}>
                        <Share2 className="mr-1 size-4" /> Invita
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
                    Condividilo con i tuoi {memberLabel.toLowerCase()}: lo inseriranno in fase di registrazione.
                  </p>
                </>
              ) : (
                <>
                  <div className="text-sm font-semibold text-cicla">✓ Ente approvato</div>
                  <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                    Attiva l'abbonamento nella sezione <strong>Abbonamento</strong> per generare il codice.
                  </p>
                </>
              )}
            </Card>
          </div>

          <div className="grid gap-4">
            <Card className="p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Dati {isMuni ? "ente" : "aziendali"}
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <Row icon={<Hash className="size-3.5" />} label="P.IVA / CF" value={company.vat ?? "—"} />
                <Row icon={<Mail className="size-3.5" />} label="Email" value={company.contact_email ?? "—"} />
                <Row icon={<CreditCard className="size-3.5" />} label="IBAN" value={company.iban ?? "—"} />
              </dl>
            </Card>
          </div>
        </div>
      )}

      {section === "membri" && (
        <div className="space-y-4">
          {canShowCode ? (
            <>
              <EmployeesSection />
              <TrackingWindowSection
                initial={{
                  tracking_start: company.tracking_start ?? null,
                  tracking_end: company.tracking_end ?? null,
                  tracking_days: (company.tracking_days as number[] | null) ?? [1, 2, 3, 4, 5],
                }}
                isMuni={isMuni}
              />
            </>
          ) : (
            <Card className="p-5 text-[13px] text-muted-foreground">
              Attiva l'abbonamento per generare il codice e iniziare a collegare i tuoi {memberLabel.toLowerCase()}.
            </Card>
          )}
        </div>
      )}

      {section === "coppe" && <CompanyChallengesSection memberLabel={memberLabel.toLowerCase()} />}

      {section === "badge" && <CompanyBadgesSection memberLabel={memberLabel.toLowerCase()} />}

      {section === "premi" && <CompanyRewardsSection />}

      {section === "documenti" && (
        <div className="space-y-4">
          <Link to="/azienda/documenti" className="block">
            <Card className="flex items-center gap-3 p-4 transition hover:bg-secondary/40">
              <FileText className="size-4 text-cicla" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">I miei documenti</div>
                <div className="text-[11px] text-muted-foreground">
                  Stato verifica, checklist mancanti e timeline revisioni
                </div>
              </div>
            </Card>
          </Link>

          <CompanyRejectionSection
            companyRejectionReason={(company as { rejection_reason?: string | null }).rejection_reason}
            reviews={reviews as never}
            onRequestReview={() => setReviewOpen(true)}
          />

          {reviews && reviews.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <History className="size-4" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Storico revisioni</span>
              </div>
              <ul className="mt-3 space-y-2">
                {reviews.map((r) => {
                  const docs = Array.isArray(r.documents) ? (r.documents as Array<{ name: string; path: string }>) : [];
                  const statusClass =
                    r.status === "approved" ? "bg-cicla/15 text-cicla"
                    : r.status === "rejected" ? "bg-destructive/15 text-destructive"
                    : "bg-warning/15 text-warning";
                  const statusLabel =
                    r.status === "approved" ? "Approvata" : r.status === "rejected" ? "Rifiutata" : "In attesa";
                  return (
                    <li key={r.id} className="rounded-md border border-border/50 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[12px] font-medium">
                          {r.kind === "initial" ? "Registrazione iniziale" : "Nuova revisione"}
                        </div>
                        <Badge variant="secondary" className={`text-[10px] ${statusClass}`}>{statusLabel}</Badge>
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        Inviata: {new Date(r.submitted_at).toLocaleString("it-IT")}
                        {r.reviewed_at && <> · Revisionata: {new Date(r.reviewed_at).toLocaleString("it-IT")}</>}
                      </div>
                      {r.notes && <div className="mt-1 text-[11px]">{r.notes}</div>}
                      {r.status === "rejected" && r.reason && (
                        <div className="mt-1 rounded bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                          Motivo: {r.reason}
                        </div>
                      )}
                      {docs.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {docs.map((d) => (
                            <span key={d.path} className="inline-flex items-center gap-1 rounded bg-secondary/60 px-1.5 py-0.5 text-[10px]">
                              <FileText className="size-3" /> {d.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <EmailLogSection companyId={company.id} title="Email di esito verifica" />

          <CompanyReviewDialog companyId={company.id} open={reviewOpen} onOpenChange={setReviewOpen} />
        </div>
      )}

      {section === "abbonamento" && (
        <Card className="p-5">
          <div className="text-sm font-semibold">
            {subActive ? "Il tuo piano" : "Attiva l'abbonamento per generare il codice"}
          </div>
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
            Il numero di account collegati al tuo codice è limitato al piano scelto.
          </p>
          <div className="mt-4 max-w-3xl">
            <PlanPicker
              memberLabel={isMuni ? "cittadini" : "dipendenti"}
              onActivated={async () => {
                await qc.invalidateQueries({ queryKey: ["my-company"] });
              }}
            />
          </div>
        </Card>
      )}
    </CompanyShell>
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

