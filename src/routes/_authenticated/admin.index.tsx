import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sendTransactionalEmail } from "@/lib/email/send";
import { logCompanyDecisionEmail } from "@/lib/email-log.functions";
import {
  adminStats,
  adminListPayouts,
  adminDecidePayout,
  adminListPendingCompanies,
  adminDecideCompany,
  adminListNotifications,
  adminMarkNotificationRead,
  adminListCompanyReviews,
  adminListTripFlags,
  adminDecideTripFlag,
  isAdmin,
} from "@/lib/admin.functions";
import { AdminShell, type AdminTab } from "@/components/cicla/AdminShell";
import { AdminListControls, AdminPagination } from "@/components/cicla/AdminListControls";
import { useAdminList } from "@/hooks/use-admin-list";
import { AdminUsersPanel } from "@/components/cicla/AdminUsersPanel";
import { DocumentViewerDialog, type DocTarget } from "@/components/cicla/DocumentViewerDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Users,
  Building2,
  Bike,
  Wallet,
  CreditCard,
  Shield,
  Check,
  X,
  Banknote,
  Bell,
  History,
  Eye,
  AlertTriangle,
  LayoutDashboard,
} from "lucide-react";

type TabId = "panoramica" | "enti" | "utenti" | "antifrode" | "prelievi" | "notifiche";

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
  const [hasSession, setHasSession] = useState<boolean | null>(true);
  const [tab, setTab] = useState<TabId>("panoramica");

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
  const listNotifications = useServerFn(adminListNotifications);
  const markRead = useServerFn(adminMarkNotificationRead);
  const listCompanyReviews = useServerFn(adminListCompanyReviews);
  const logEmailFn = useServerFn(logCompanyDecisionEmail);
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [docTarget, setDocTarget] = useState<DocTarget>(null);

  const { data: companies } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: () => listPendingCompanies({}),
    enabled: adminCheck?.admin === true,
  });

  const { data: notifications } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => listNotifications({}),
    enabled: adminCheck?.admin === true,
  });

  // Realtime: sostituisce il polling. Si iscrive a notifiche admin,
  // enti registrati e revisioni; ad ogni evento invalida le query corrispondenti.
  useEffect(() => {
    if (adminCheck?.admin !== true) return;
    const channel = supabase
      .channel("admin-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_notifications" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["admin-notifications"] });
          qc.invalidateQueries({ queryKey: ["admin-companies"] });
          qc.invalidateQueries({ queryKey: ["admin-stats"] });
          if (payload.eventType === "INSERT") {
            const n = payload.new as { title?: string; message?: string };
            toast(n.title ?? "Nuova notifica", { description: n.message });
          }
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "company_reviews" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-company-reviews"] });
        qc.invalidateQueries({ queryKey: ["admin-companies"] });
        qc.invalidateQueries({ queryKey: ["admin-stats"] });
      })

      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [adminCheck?.admin, qc]);

  const listTripFlags = useServerFn(adminListTripFlags);
  const decideTripFlag = useServerFn(adminDecideTripFlag);

  const { data: tripFlags } = useQuery({
    queryKey: ["admin-trip-flags"],
    queryFn: () => listTripFlags({}),
    enabled: adminCheck?.admin === true,
  });

  async function handleFlagDecide(id: string, decision: "confirmed" | "dismissed") {
    try {
      await decideTripFlag({ data: { flag_id: id, decision } });
      toast.success(
        decision === "confirmed" ? "Frode confermata, punti revocati" : "Viaggio validato",
      );
      await qc.invalidateQueries({ queryKey: ["admin-trip-flags"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
  }

  const { data: companyReviews } = useQuery({
    queryKey: ["admin-company-reviews", expandedCompanyId],
    queryFn: () => listCompanyReviews({ data: { company_id: expandedCompanyId! } }),
    enabled: adminCheck?.admin === true && !!expandedCompanyId,
  });

  const unreadCount = notifications?.filter((n) => !n.read_at).length ?? 0;
  const pendingCompaniesCount = companies?.filter((c) => c.status === "pending").length ?? 0;
  const pendingPayoutsCount = payouts?.filter((p) => p.status === "pending").length ?? 0;
  const pendingFlagsCount = tripFlags?.filter((f) => f.status === "pending").length ?? 0;

  // Ricerca, filtri, ordinamento e paginazione per le tre code operative
  const companiesList = useAdminList({
    items: companies,
    searchText: (c) => `${c.name} ${c.vat ?? ""} ${c.contact_email} ${c.kind}`,
    status: (c) => c.status,
    date: (c) => c.created_at,
    // più tempo in attesa = più urgente
    urgency: (c) => -new Date(c.created_at).getTime() / 1e10,
  });

  const flagsList = useAdminList({
    items: tripFlags,
    searchText: (f) => `${f.user_name} ${f.declared_mode} ${f.predicted_mode} ${f.reason ?? ""}`,
    status: (f) => f.status,
    date: (f) => f.started_at,
    urgency: (f) => Number(f.score) || 0,
  });

  const payoutsList = useAdminList({
    items: payouts,
    searchText: (p) => `${p.user_name} ${p.iban_snapshot ?? ""} ${p.amount_eur}`,
    status: (p) => p.status,
    date: (p) => p.created_at,
    urgency: (p) => Number(p.amount_eur) || 0,
  });

  async function handleDecide(id: string, decision: "approved" | "rejected" | "paid") {
    try {
      await decide({ data: { payout_id: id, decision } });
      toast.success(
        decision === "approved"
          ? "Approvato"
          : decision === "rejected"
            ? "Rifiutato (punti restituiti)"
            : "Segnato come pagato",
      );
      await qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      await qc.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
  }

  async function handleCompanyDecide(id: string, decision: "approved" | "rejected") {
    try {
      const reason =
        decision === "rejected"
          ? (window.prompt("Motivo del rifiuto (verrà mostrato all'ente):") ?? undefined)
          : undefined;
      const res = await decideCompanyFn({ data: { company_id: id, decision, reason } });
      toast.success(decision === "approved" ? "Ente approvato" : "Ente rifiutato");

      // Email di notifica all'ente (data, motivazione e prossimo passo)
      const pushRes = (
        res as { push?: { configured: boolean; sent: number; failed: number } | null }
      )?.push;
      if (pushRes?.configured && pushRes.sent > 0) {
        toast.success(`Notifica push inviata a ${pushRes.sent} dispositivo/i`);
      } else if (pushRes?.configured && pushRes.failed > 0) {
        toast.warning("Push non consegnata: restano email e notifica in-app");
      }

      const email = (res as { email?: Record<string, unknown> | null })?.email;
      if (email?.recipient) {
        const idem = `company-decision-${id}-${decision}-${String(email.decidedAt ?? "")}`;
        let sendError: string | null = null;
        try {
          await sendTransactionalEmail({
            templateName: "company-decision",
            recipientEmail: String(email.recipient),
            idempotencyKey: idem,
            templateData: {
              companyName: email.companyName,
              kind: email.kind,
              decision: email.decision,
              decidedAt: email.decidedAt,
              reason: email.reason,
              code: email.code,
              appUrl: window.location.origin,
            },
          });
        } catch (err) {
          sendError = err instanceof Error ? err.message : "Errore invio email";
          toast.warning("Decisione salvata, ma l'email all'ente non è partita");
        }
        try {
          await logEmailFn({
            data: {
              company_id: id,
              recipient_email: String(email.recipient),
              decision,
              status: sendError ? "failed" : "sent",
              error_message: sendError ? sendError.slice(0, 500) : null,
              idempotency_key: idem,
            },
          });
        } catch {
          /* il log non deve bloccare la decisione */
        }
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-companies"] }),
        qc.invalidateQueries({ queryKey: ["admin-stats"] }),
        qc.invalidateQueries({ queryKey: ["admin-notifications"] }),
        qc.invalidateQueries({ queryKey: ["admin-company-reviews"] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
  }

  async function markAllRead() {
    await markRead({ data: { all: true } });
    await qc.invalidateQueries({ queryKey: ["admin-notifications"] });
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

  const tabs: AdminTab[] = [
    { id: "panoramica", label: "Panoramica", icon: LayoutDashboard },
    { id: "enti", label: "Enti", icon: Building2, count: pendingCompaniesCount },
    { id: "utenti", label: "Utenti", icon: Users },
    { id: "antifrode", label: "Anti-frode", icon: AlertTriangle, count: pendingFlagsCount },
    { id: "prelievi", label: "Prelievi", icon: Wallet, count: pendingPayoutsCount },
    { id: "notifiche", label: "Notifiche", icon: Bell, count: unreadCount },
  ];

  return (
    <AdminShell
      title="Pannello admin"
      subtitle="Enti, verifiche, anti-frode e prelievi in un'unica vista"
      unread={unreadCount}
      tabs={tabs}
      activeTab={tab}
      onTabChange={(id) => setTab(id as TabId)}
    >
      <div className="space-y-6">
        {tab === "panoramica" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <Stat icon={<Users className="size-4" />} label="Utenti" value={stats?.users} />
              <Stat
                icon={<Building2 className="size-4" />}
                label="Aziende"
                value={stats?.companies}
              />
              <Stat icon={<Bike className="size-4" />} label="Bici" value={stats?.bikes} />
              <Stat
                icon={<CreditCard className="size-4" />}
                label="Abb. attivi"
                value={stats?.active_subscriptions}
              />
              <Stat
                icon={<Wallet className="size-4" />}
                label="Prelievi pending"
                value={stats?.pending_payouts}
                highlight
              />
            </div>

            {/* Centro verifiche enti */}
            <Link to="/admin/verifiche" className="block">
              <Card className="flex items-center justify-between p-5 transition hover:border-cicla/40">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Verifiche enti
                  </div>
                  <div className="mt-1 text-sm font-semibold">
                    Coda, filtri, cronologia e documenti
                  </div>
                </div>
                <Shield className="size-5 text-cicla" />
              </Card>
            </Link>
          </>
        )}

        <div className="grid items-start gap-6 xl:grid-cols-2">
          {/* Notifiche admin */}
          {tab === "notifiche" && notifications && notifications.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Bell className="size-4" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">
                    Notifiche
                  </span>
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="bg-warning/15 text-warning text-[10px]">
                      {unreadCount} nuove
                    </Badge>
                  )}
                </div>
                {unreadCount > 0 && (
                  <Button size="sm" variant="ghost" onClick={markAllRead}>
                    Segna tutte lette
                  </Button>
                )}
              </div>
              <ul className="mt-3 space-y-2">
                {notifications.slice(0, 8).map((n) => (
                  <li
                    key={n.id}
                    className={`rounded-md border border-border/50 p-2.5 text-[12px] ${!n.read_at ? "bg-warning/5" : ""}`}
                    onClick={() => n.company_id && setExpandedCompanyId(n.company_id)}
                    role="button"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{n.title}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString("it-IT")}
                      </span>
                    </div>
                    {n.body && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{n.body}</div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Enti (aziende/comuni) da approvare */}
          {tab === "enti" && (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Enti registrati
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {companies?.filter((c) => c.status === "pending").length ?? 0} in attesa
                </span>
              </div>
              <AdminListControls
                query={companiesList.query}
                onQuery={companiesList.setQuery}
                statuses={companiesList.statuses}
                statusFilter={companiesList.statusFilter}
                onStatus={companiesList.setStatusFilter}
                sort={companiesList.sort}
                onSort={companiesList.setSort}
                placeholder="Cerca per nome, P.IVA o email…"
              />

              {companiesList.total === 0 ? (
                <p className="mt-3 text-[12px] text-muted-foreground">Nessun ente registrato.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {companiesList.items.map((c) => (
                    <li key={c.id} className="rounded-lg border border-border/50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium">{c.name}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {c.kind === "municipality" ? "Comune" : "Azienda"}
                            </Badge>
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            P.IVA/CF: {c.vat ?? "—"} · {c.contact_email}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(c.created_at).toLocaleString("it-IT")}
                          </div>
                          {c.status === "rejected" && c.rejection_reason && (
                            <div className="mt-1 text-[10px] text-destructive">
                              Motivo: {c.rejection_reason}
                            </div>
                          )}
                        </div>
                        <StatusBadge status={c.status} />
                      </div>
                      {c.status === "pending" && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleCompanyDecide(c.id, "approved")}
                          >
                            <Check className="mr-1 size-3.5" /> Approva
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleCompanyDecide(c.id, "rejected")}
                          >
                            <X className="mr-1 size-3.5" /> Rifiuta
                          </Button>
                        </div>
                      )}
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px]"
                          onClick={() =>
                            setExpandedCompanyId(expandedCompanyId === c.id ? null : c.id)
                          }
                        >
                          <History className="mr-1 size-3" />
                          {expandedCompanyId === c.id
                            ? "Nascondi storico"
                            : "Vedi storico & documenti"}
                        </Button>
                      </div>
                      {expandedCompanyId === c.id && (
                        <div className="mt-2 space-y-2 rounded-md border border-border/50 bg-secondary/30 p-2">
                          {!companyReviews || companyReviews.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground">
                              Nessuna revisione registrata.
                            </p>
                          ) : (
                            companyReviews.map((r) => {
                              const docs = Array.isArray(r.documents)
                                ? (r.documents as Array<{ name: string; path: string }>)
                                : [];
                              return (
                                <div
                                  key={r.id}
                                  className="rounded border border-border/40 bg-background/60 p-2 text-[11px]"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">
                                      {r.kind === "initial" ? "Iniziale" : "Nuova revisione"}
                                    </span>
                                    <Badge variant="secondary" className="text-[10px]">
                                      {r.status}
                                    </Badge>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {new Date(r.submitted_at).toLocaleString("it-IT")}
                                  </div>
                                  {r.notes && <div className="mt-1">{r.notes}</div>}
                                  {r.reason && (
                                    <div className="mt-1 text-destructive">Motivo: {r.reason}</div>
                                  )}
                                  {docs.length > 0 && (
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                      {docs.map((d) => (
                                        <Button
                                          key={d.path}
                                          size="sm"
                                          variant="outline"
                                          className="h-6 px-1.5 text-[10px]"
                                          onClick={() =>
                                            setDocTarget({ name: d.name, path: d.path })
                                          }
                                        >
                                          <Eye className="mr-1 size-3" /> {d.name}
                                        </Button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <AdminPagination
                page={companiesList.page}
                pageCount={companiesList.pageCount}
                total={companiesList.total}
                onPage={companiesList.setPage}
              />
            </Card>
          )}

          {/* Utenti e ruoli */}
          {tab === "utenti" && <AdminUsersPanel />}

          {/* Coda anti-frode */}
          {tab === "antifrode" && (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <AlertTriangle className="size-4" /> Revisione anti-frode
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {tripFlags?.filter((f) => f.status === "pending").length ?? 0} da esaminare
                </span>
              </div>

              <AdminListControls
                query={flagsList.query}
                onQuery={flagsList.setQuery}
                statuses={flagsList.statuses}
                statusFilter={flagsList.statusFilter}
                onStatus={flagsList.setStatusFilter}
                sort={flagsList.sort}
                onSort={flagsList.setSort}
                placeholder="Cerca per utente, modalità o motivo…"
              />

              {flagsList.total === 0 ? (
                <p className="mt-3 text-[12px] text-muted-foreground">Nessun viaggio segnalato.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {flagsList.items.map((f) => (
                    <li key={f.id} className="rounded-lg border border-border/50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{f.user_name}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            Dichiarato <b>{f.declared_mode}</b> · stimato <b>{f.predicted_mode}</b>{" "}
                            · score {Number(f.score).toFixed(2)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {f.distance_km.toFixed(1)} km · {f.points_earned} pt
                          </div>
                          {f.reason && (
                            <div className="mt-1 text-[10px] text-muted-foreground">{f.reason}</div>
                          )}
                          <div className="mt-1 text-[10px] text-muted-foreground">
                            {new Date(f.started_at).toLocaleString("it-IT")}
                          </div>
                        </div>
                        <StatusBadge status={f.status} />
                      </div>
                      {f.status === "pending" && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleFlagDecide(f.id, "dismissed")}
                          >
                            <Check className="mr-1 size-3.5" /> Legittimo
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleFlagDecide(f.id, "confirmed")}
                          >
                            <X className="mr-1 size-3.5" /> Frode (revoca punti)
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <AdminPagination
                page={flagsList.page}
                pageCount={flagsList.pageCount}
                total={flagsList.total}
                onPage={flagsList.setPage}
              />
            </Card>
          )}

          {/* Payouts */}
          {tab === "prelievi" && (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Richieste di prelievo
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {payouts?.length ?? 0} totali
                </span>
              </div>

              <AdminListControls
                query={payoutsList.query}
                onQuery={payoutsList.setQuery}
                statuses={payoutsList.statuses}
                statusFilter={payoutsList.statusFilter}
                onStatus={payoutsList.setStatusFilter}
                sort={payoutsList.sort}
                onSort={payoutsList.setSort}
                placeholder="Cerca per utente, IBAN o importo…"
              />

              {payoutsList.total === 0 ? (
                <p className="mt-3 text-[12px] text-muted-foreground">Nessuna richiesta.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {payoutsList.items.map((p) => (
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
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleDecide(p.id, "approved")}
                          >
                            <Check className="mr-1 size-3.5" /> Approva
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleDecide(p.id, "rejected")}
                          >
                            <X className="mr-1 size-3.5" /> Rifiuta
                          </Button>
                        </div>
                      )}
                      {p.status === "approved" && (
                        <Button
                          size="sm"
                          className="mt-3 w-full"
                          onClick={() => handleDecide(p.id, "paid")}
                        >
                          <Banknote className="mr-1 size-3.5" /> Segna come pagato
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <AdminPagination
                page={payoutsList.page}
                pageCount={payoutsList.pageCount}
                total={payoutsList.total}
                onPage={payoutsList.setPage}
              />
            </Card>
          )}
        </div>
      </div>

      <DocumentViewerDialog target={docTarget} onClose={() => setDocTarget(null)} />
    </AdminShell>
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
