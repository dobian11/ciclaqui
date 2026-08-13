import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  isAdmin,
  adminListVerifications,
  adminDecideCompany,
  adminListAuditLog,
} from "@/lib/admin.functions";
import { sendTransactionalEmail } from "@/lib/email/send";
import { logCompanyDecisionEmail } from "@/lib/email-log.functions";
import { EmailLogSection } from "@/components/cicla/EmailLogSection";
import {
  DecisionEmailPreview,
  type DecisionPreviewTarget,
} from "@/components/cicla/DecisionEmailPreview";
import { AdminShell } from "@/components/cicla/AdminShell";
import { DocumentViewerDialog, type DocTarget } from "@/components/cicla/DocumentViewerDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2,
  ListChecks,
  Search,
  FileText,
  Check,
  X,
  History,
  Building2,
  Landmark,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertTriangle,
  Eye,
  ScrollText,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/verifiche")({
  ssr: false,
  component: AdminVerificationsPage,
  head: () => ({
    meta: [
      { title: "Verifiche enti — Admin Cicla Qui" },
      {
        name: "description",
        content:
          "Centro admin per approvare o rifiutare le richieste di verifica di aziende e comuni, con filtri, cronologia e documenti.",
      },
      { property: "og:title", content: "Verifiche enti — Admin Cicla Qui" },
      {
        property: "og:description",
        content:
          "Approva o rifiuta le verifiche degli enti con filtri, cronologia azioni e documenti.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type StatusFilter = "all" | "pending" | "approved" | "rejected" | "suspended";
type KindFilter = "all" | "company" | "municipality";

const STATUS_LABEL: Record<string, string> = {
  pending: "In attesa",
  approved: "Approvato",
  rejected: "Rifiutato",
  suspended: "Sospeso",
};

function statusClass(status: string) {
  if (status === "approved") return "bg-cicla/15 text-cicla";
  if (status === "rejected") return "bg-destructive/15 text-destructive";
  if (status === "suspended") return "bg-amber-500/15 text-amber-500";
  return "bg-secondary text-muted-foreground";
}

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : "—";
}

function AdminVerificationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const checkAdmin = useServerFn(isAdmin);
  const listVerifications = useServerFn(adminListVerifications);
  const decideCompanyFn = useServerFn(adminDecideCompany);
  const listAudit = useServerFn(adminListAuditLog);
  const [docTarget, setDocTarget] = useState<DocTarget>(null);
  const logEmailFn = useServerFn(logCompanyDecisionEmail);

  const [hasSession, setHasSession] = useState<boolean | null>(true);
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [kind, setKind] = useState<KindFilter>("all");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState<"queue" | "history" | "audit">("queue");
  const [auditAction, setAuditAction] = useState<
    "all" | "document_viewed" | "company_approved" | "company_rejected"
  >("all");
  const [rejectFor, setRejectFor] = useState<{ id: string; name: string } | null>(null);
  const [previewFor, setPreviewFor] = useState<DecisionPreviewTarget | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
  }, []);

  const { data: adminCheck, isLoading: checking } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => checkAdmin({}),
    enabled: hasSession === true,
    retry: false,
  });

  useEffect(() => {
    if (adminCheck && adminCheck.admin === false) navigate({ to: "/app" });
  }, [adminCheck, navigate]);

  const { data: companies, isLoading } = useQuery({
    queryKey: ["admin-verifications"],
    queryFn: () => listVerifications({}),
    enabled: adminCheck?.admin === true,
  });

  const { data: auditRows, isLoading: auditLoading } = useQuery({
    queryKey: ["admin-audit-log", auditAction],
    queryFn: () => listAudit({ data: auditAction === "all" ? {} : { action: auditAction } }),
    enabled: adminCheck?.admin === true && tab === "audit",
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (companies ?? []).filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (kind !== "all" && c.kind !== kind) return false;
      if (!needle) return true;
      return [c.name, c.code, c.vat, c.contact_email, c.owner_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [companies, status, kind, q]);

  const history = useMemo(() => {
    const rows = (companies ?? []).flatMap((c) =>
      c.reviews
        .filter((r) => r.status !== "pending" && r.reviewed_at)
        .map((r) => ({
          id: r.id,
          companyName: c.name,
          kind: c.kind,
          status: r.status,
          reason: r.reason,
          at: r.reviewed_at as string,
          by: r.reviewed_by_name ?? "—",
          docs: r.documents.length,
        })),
    );
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => (kind === "all" ? true : r.kind === kind))
      .filter((r) => (status === "approved" || status === "rejected" ? r.status === status : true))
      .filter((r) => (needle ? r.companyName.toLowerCase().includes(needle) : true))
      .sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [companies, kind, status, q]);

  const counts = useMemo(() => {
    const all = companies ?? [];
    return {
      pending: all.filter((c) => c.status === "pending").length,
      approved: all.filter((c) => c.status === "approved").length,
      rejected: all.filter((c) => c.status === "rejected").length,
    };
  }, [companies]);

  async function runDecision(id: string, decision: "approved" | "rejected", motivo?: string) {
    setBusy(id);
    try {
      const res = await decideCompanyFn({ data: { company_id: id, decision, reason: motivo } });
      toast.success(decision === "approved" ? "Ente approvato" : "Ente rifiutato");

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
        qc.invalidateQueries({ queryKey: ["admin-verifications"] }),
        qc.invalidateQueries({ queryKey: ["admin-companies"] }),
        qc.invalidateQueries({ queryKey: ["admin-stats"] }),
        qc.invalidateQueries({ queryKey: ["admin-notifications"] }),
        qc.invalidateQueries({ queryKey: ["admin-audit-log"] }),
        qc.invalidateQueries({ queryKey: ["company-email-log"] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(null);
    }
  }

  if (checking || adminCheck?.admin !== true) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AdminShell
      title="Richieste di verifica"
      subtitle={`${counts.pending} in attesa · ${counts.approved} approvati · ${counts.rejected} rifiutati`}
      tabs={[
        { id: "queue", label: "Coda", icon: ListChecks, count: counts.pending },
        { id: "history", label: "Cronologia", icon: History },
        { id: "audit", label: "Audit", icon: ScrollText },
      ]}
      activeTab={tab}
      onTabChange={(id) => setTab(id as "queue" | "history" | "audit")}
    >
      <div>
        {/* Filtri */}
        {tab !== "audit" && (
          <Card className="mt-4 space-y-3 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cerca per nome, codice, P.IVA, email…"
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(["all", "pending", "approved", "rejected", "suspended"] as StatusFilter[]).map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                      status === s
                        ? "bg-cicla text-cicla-foreground"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {s === "all" ? "Tutti" : STATUS_LABEL[s]}
                  </button>
                ),
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["all", "Tutti gli enti"],
                  ["company", "Aziende"],
                  ["municipality", "Comuni"],
                ] as [KindFilter, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    kind === k
                      ? "bg-foreground text-background"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Card>
        )}

        {isLoading && tab !== "audit" && (
          <div className="mt-6 flex justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Coda verifiche */}
        {tab === "queue" && !isLoading && (
          <div className="mt-4 space-y-3">
            {filtered.length === 0 && (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                Nessun ente corrisponde ai filtri selezionati.
              </Card>
            )}

            {filtered.map((c) => {
              const open = expanded === c.id;
              const isMuni = c.kind === "municipality";
              return (
                <Card key={c.id} className="p-4">
                  <button
                    className="flex w-full items-start justify-between gap-2 text-left"
                    onClick={() => setExpanded(open ? null : c.id)}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isMuni ? (
                          <Landmark className="size-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate text-sm font-semibold">{c.name}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${statusClass(c.status)}`}
                        >
                          {STATUS_LABEL[c.status] ?? c.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {c.doc_count} doc · inviato {fmt(c.last_submitted_at)}
                        </span>
                      </div>
                    </div>
                    {open ? (
                      <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>

                  {open && (
                    <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
                      <dl className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <dt className="text-muted-foreground">Codice</dt>
                          <dd className="font-mono">{c.code}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">P.IVA / CF</dt>
                          <dd>{c.vat || "—"}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-muted-foreground">Email referente</dt>
                          <dd className="truncate">{c.contact_email}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-muted-foreground">Referente</dt>
                          <dd>{c.owner_name}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-muted-foreground">IBAN</dt>
                          <dd className="font-mono text-[10px]">{c.iban || "—"}</dd>
                        </div>
                      </dl>

                      {c.status === "rejected" && c.rejection_reason && (
                        <div className="rounded bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
                          <AlertTriangle className="mr-1 inline size-3" />
                          Motivo rifiuto: {c.rejection_reason}
                        </div>
                      )}

                      {/* Pratiche + documenti */}
                      {c.reviews.length === 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Nessuna pratica inviata: l'ente non ha ancora caricato documenti.
                        </p>
                      )}

                      {c.reviews.map((r) => (
                        <div key={r.id} className="rounded-md border border-border/60 p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold">
                              {r.kind === "resubmission" ? "Nuova revisione" : "Prima richiesta"}
                            </span>
                            <Badge
                              variant="secondary"
                              className={`text-[10px] ${statusClass(r.status)}`}
                            >
                              {STATUS_LABEL[r.status] ?? r.status}
                            </Badge>
                          </div>
                          <div className="mt-1 text-[10px] text-muted-foreground">
                            Inviata {fmt(r.submitted_at)} da {r.submitted_by_name}
                            {r.reviewed_at
                              ? ` · Decisa ${fmt(r.reviewed_at)} da ${r.reviewed_by_name}`
                              : ""}
                          </div>
                          {r.notes && (
                            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                              {r.notes}
                            </p>
                          )}
                          {r.reason && (
                            <p className="mt-1.5 text-[11px] text-destructive">
                              Motivo: {r.reason}
                            </p>
                          )}

                          {r.documents.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {r.documents.map((d) => (
                                <li
                                  key={d.path}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <span className="flex min-w-0 items-center gap-1.5">
                                    <FileText className="size-3 shrink-0 text-muted-foreground" />
                                    <span className="truncate text-[11px]">{d.name}</span>
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 shrink-0 px-2 text-[10px]"
                                    onClick={() => setDocTarget({ name: d.name, path: d.path })}
                                  >
                                    <Eye className="mr-1 size-3" /> Apri
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}

                      {/* Azioni */}
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={busy === c.id || c.status === "approved"}
                          onClick={() =>
                            setPreviewFor({ id: c.id, name: c.name, decision: "approved" })
                          }
                        >
                          {busy === c.id ? (
                            <Loader2 className="mr-1 size-3.5 animate-spin" />
                          ) : (
                            <Check className="mr-1 size-3.5" />
                          )}
                          Anteprima e approva
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={busy === c.id}
                          onClick={() => {
                            setReason("");
                            setRejectFor({ id: c.id, name: c.name });
                          }}
                        >
                          <X className="mr-1 size-3.5" /> Rifiuta
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Cronologia azioni */}
        {tab === "history" && !isLoading && (
          <Card className="mt-4 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <History className="size-4" />
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                Cronologia azioni
              </span>
            </div>

            {history.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nessuna decisione registrata con questi filtri.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="rounded-md border border-border/60 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-[12px] font-semibold">{h.companyName}</span>
                      <Badge
                        variant="secondary"
                        className={`shrink-0 text-[10px] ${statusClass(h.status)}`}
                      >
                        {STATUS_LABEL[h.status] ?? h.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="size-3" /> {fmt(h.at)} · {h.by} · {h.docs} doc
                    </div>
                    {h.reason && (
                      <p className="mt-1 text-[11px] text-destructive">Motivo: {h.reason}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* Registro di audit */}
        {tab === "audit" && (
          <>
            <EmailLogSection showCompanyName title="Log email di decisione" />
            <Card className="mt-4 p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ScrollText className="size-4" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Registro accessi e decisioni
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                Ogni apertura di un documento e ogni cambio di stato di verifica viene registrato in
                modo permanente con autore, data e ora.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(
                  [
                    ["all", "Tutto"],
                    ["document_viewed", "Documenti visti"],
                    ["company_approved", "Approvazioni"],
                    ["company_rejected", "Rifiuti"],
                  ] as [typeof auditAction, string][]
                ).map(([a, label]) => (
                  <button
                    key={a}
                    onClick={() => setAuditAction(a)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                      auditAction === a
                        ? "bg-cicla text-cicla-foreground"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Card>

            {auditLoading && (
              <div className="mt-6 flex justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!auditLoading && (auditRows?.length ?? 0) === 0 && (
              <Card className="mt-3 p-6 text-center text-sm text-muted-foreground">
                Nessuna voce registrata con questo filtro.
              </Card>
            )}

            <ul className="mt-3 space-y-2">
              {(auditRows ?? []).map((r) => {
                const viewed = r.action === "document_viewed";
                const rejected = r.action === "company_rejected";
                return (
                  <li key={r.id} className="rounded-md border border-border/60 bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {viewed ? (
                          <Eye className="size-3.5 shrink-0 text-muted-foreground" />
                        ) : rejected ? (
                          <X className="size-3.5 shrink-0 text-destructive" />
                        ) : (
                          <Check className="size-3.5 shrink-0 text-cicla" />
                        )}
                        <span className="truncate text-[12px] font-semibold">{r.company_name}</span>
                      </span>
                      <Badge
                        variant="secondary"
                        className={`shrink-0 text-[10px] ${
                          viewed
                            ? "bg-secondary text-muted-foreground"
                            : rejected
                              ? "bg-destructive/15 text-destructive"
                              : "bg-cicla/15 text-cicla"
                        }`}
                      >
                        {viewed ? "Documento visto" : rejected ? "Rifiutato" : "Approvato"}
                      </Badge>
                    </div>

                    <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="size-3" /> {fmt(r.created_at)} · {r.actor_name ?? "—"}
                      {r.actor_role
                        ? ` (${r.actor_role === "admin" ? "admin" : "referente ente"})`
                        : ""}
                    </div>

                    {r.document_name && (
                      <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                        <FileText className="size-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{r.document_name}</span>
                      </div>
                    )}
                    {r.reason && (
                      <p className="mt-1 text-[11px] text-destructive">Motivo: {r.reason}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* Dialog rifiuto */}
      <Dialog open={!!rejectFor} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rifiuta {rejectFor?.name}</DialogTitle>
            <DialogDescription>
              Il motivo verrà mostrato all'ente nella dashboard e inviato via email.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Es. La visura camerale allegata è scaduta: caricane una emessa negli ultimi 6 mesi."
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectFor(null)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || busy === rejectFor?.id}
              onClick={() => {
                if (!rejectFor) return;
                const target = rejectFor;
                setRejectFor(null);
                setPreviewFor({
                  id: target.id,
                  name: target.name,
                  decision: "rejected",
                  reason: reason.trim(),
                });
              }}
            >
              Anteprima email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Anteprima email di esito prima dell'invio */}
      <DecisionEmailPreview
        target={previewFor}
        busy={!!previewFor && busy === previewFor.id}
        onClose={() => setPreviewFor(null)}
        onConfirm={async (t) => {
          setPreviewFor(null);
          await runDecision(t.id, t.decision, t.reason || undefined);
        }}
      />

      {/* Visualizzatore documenti in-app */}
      <DocumentViewerDialog target={docTarget} onClose={() => setDocTarget(null)} />
    </AdminShell>
  );
}
