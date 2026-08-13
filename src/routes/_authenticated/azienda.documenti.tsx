import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyCompany, listMyCompanyReviews } from "@/lib/companies.functions";
import { docSpecs, normalizeDocName, type UploadedDoc } from "@/lib/company-docs";
import { DocumentViewerDialog, type DocTarget } from "@/components/cicla/DocumentViewerDialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock,
  Eye,
  FileText,
  History,
  ShieldCheck,
  XCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/azienda/documenti")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "I miei documenti — Cicla Qui" },
      {
        name: "description",
        content:
          "Stato di verifica dei documenti del tuo ente, checklist di quelli mancanti e timeline delle revisioni.",
      },
      { property: "og:title", content: "I miei documenti — Cicla Qui" },
      {
        property: "og:description",
        content: "Verifica documenti, checklist e storico revisioni del tuo ente su Cicla Qui.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompanyDocumentsPage,
});

type ReviewRow = {
  id: string;
  kind: string;
  status: string;
  reason: string | null;
  notes: string | null;
  documents: unknown;
  submitted_at: string;
  reviewed_at: string | null;
};

function statusMeta(status: string) {
  if (status === "approved")
    return { label: "Approvata", cls: "bg-cicla/15 text-cicla", Icon: Check };
  if (status === "rejected")
    return { label: "Rifiutata", cls: "bg-destructive/15 text-destructive", Icon: XCircle };
  return { label: "In attesa", cls: "bg-warning/15 text-warning", Icon: Clock };
}

function CompanyDocumentsPage() {
  const fetchCompany = useServerFn(getMyCompany);
  const fetchReviews = useServerFn(listMyCompanyReviews);
  const [docTarget, setDocTarget] = useState<DocTarget | null>(null);

  const { data: company, isLoading } = useQuery({
    queryKey: ["my-company"],
    queryFn: () => fetchCompany(),
  });
  const { data: reviews } = useQuery({
    queryKey: ["my-company-reviews"],
    queryFn: () => fetchReviews(),
    enabled: !!company,
  });

  const specs = docSpecs(company?.kind ?? "company");

  // Documento più recente per ciascuno slot della checklist
  const latestByKey = useMemo(() => {
    const map = new Map<string, { doc: UploadedDoc; review: ReviewRow }>();
    const list = ((reviews ?? []) as ReviewRow[])
      .slice()
      .sort((a, b) => +new Date(a.submitted_at) - +new Date(b.submitted_at));
    for (const r of list) {
      const docs = Array.isArray(r.documents) ? (r.documents as UploadedDoc[]) : [];
      for (const d of docs) {
        const name = normalizeDocName(d.doc_key ?? d.name ?? "");
        const spec = specs.find(
          (s) => s.key === d.doc_key || s.match.some((m) => name.includes(normalizeDocName(m))),
        );
        if (spec) map.set(spec.key, { doc: d, review: r });
      }
    }
    return map;
  }, [reviews, specs]);

  const missing = specs.filter((s) => s.required && !latestByKey.has(s.key));
  const status = company?.status ?? "pending";
  const meta = statusMeta(status === "approved" ? "approved" : status === "rejected" ? "rejected" : "pending");

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/40 to-background pb-12">
      <div className="mx-auto max-w-md px-5 py-6">
        <Link to="/azienda" className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <ArrowLeft className="size-3.5" /> Torna al pannello
        </Link>

        <h1 className="mt-3 text-2xl font-bold tracking-tight">I miei documenti</h1>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Stato della verifica, documenti mancanti e storico delle revisioni del tuo ente.
        </p>

        {isLoading ? (
          <Card className="mt-5 p-5 text-[12px] text-muted-foreground">Caricamento…</Card>
        ) : !company ? (
          <Card className="mt-5 p-5 text-[12px] text-muted-foreground">
            Nessun ente associato al tuo account.
          </Card>
        ) : (
          <>
            {/* Stato verifica */}
            <Card className="mt-5 p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShieldCheck className="size-4" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">
                    Stato verifica
                  </span>
                </div>
                <Badge variant="secondary" className={`text-[10px] ${meta.cls}`}>
                  {status === "approved"
                    ? "Approvato"
                    : status === "rejected"
                      ? "Rifiutato"
                      : status === "suspended"
                        ? "Sospeso"
                        : "In verifica"}
                </Badge>
              </div>
              <div className="mt-2 text-sm font-medium">{company.name}</div>
              {status === "rejected" && company.rejection_reason && (
                <div className="mt-2 rounded bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
                  Motivo: {company.rejection_reason}
                </div>
              )}
              <div className="mt-3 text-[11px] text-muted-foreground">
                {specs.length - missing.length}/{specs.filter((s) => s.required).length} documenti
                obbligatori caricati
              </div>
            </Card>

            {/* Checklist */}
            <Card className="mt-4 p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="size-4" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Checklist documenti
                </span>
              </div>

              {missing.length > 0 && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2.5 text-[11px]">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                  <span>
                    Mancano {missing.length} documenti obbligatori: {missing.map((m) => m.label).join(", ")}.
                    Inviali con una nuova revisione dal pannello.
                  </span>
                </div>
              )}

              <ul className="mt-3 space-y-2">
                {specs.map((spec) => {
                  const entry = latestByKey.get(spec.key);
                  return (
                    <li
                      key={spec.key}
                      className={`rounded-lg border p-3 ${
                        entry ? "border-cicla/40 bg-cicla/5" : "border-border/60"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${
                            entry ? "bg-cicla/20 text-cicla" : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {entry ? <Check className="size-3" /> : <Clock className="size-3" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13px] font-medium">{spec.label}</span>
                            <Badge variant="secondary" className="text-[9px]">
                              {spec.required ? "Obbligatorio" : "Facoltativo"}
                            </Badge>
                          </div>
                          <div className="text-[11px] leading-snug text-muted-foreground">
                            {spec.hint}
                          </div>
                          {entry ? (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="truncate text-[11px]">{entry.doc.name}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="ml-auto h-6 px-1.5 text-[10px]"
                                onClick={() =>
                                  setDocTarget({ name: entry.doc.name, path: entry.doc.path })
                                }
                              >
                                <Eye className="mr-1 size-3" /> Vedi
                              </Button>
                            </div>
                          ) : (
                            <div className="mt-1.5 text-[11px] text-warning">Non ancora caricato</div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>

            {/* Timeline revisioni */}
            <Card className="mt-4 p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <History className="size-4" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Timeline revisioni
                </span>
              </div>
              {!reviews || reviews.length === 0 ? (
                <p className="mt-3 text-[12px] text-muted-foreground">
                  Nessuna revisione inviata finora.
                </p>
              ) : (
                <ol className="mt-3 space-y-3 border-l border-border/60 pl-4">
                  {(reviews as ReviewRow[]).map((r) => {
                    const m = statusMeta(r.status);
                    const docs = Array.isArray(r.documents) ? (r.documents as UploadedDoc[]) : [];
                    return (
                      <li key={r.id} className="relative">
                        <span className="absolute -left-[21px] top-1 grid size-3.5 place-items-center rounded-full bg-secondary text-muted-foreground">
                          <m.Icon className="size-2.5" />
                        </span>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] font-medium">
                            {r.kind === "initial" ? "Registrazione iniziale" : "Nuova revisione"}
                          </span>
                          <Badge variant="secondary" className={`text-[10px] ${m.cls}`}>
                            {m.label}
                          </Badge>
                        </div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          Inviata: {new Date(r.submitted_at).toLocaleString("it-IT")}
                          {r.reviewed_at && (
                            <> · Revisionata: {new Date(r.reviewed_at).toLocaleString("it-IT")}</>
                          )}
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
                              <Button
                                key={d.path}
                                size="sm"
                                variant="outline"
                                className="h-6 px-1.5 text-[10px]"
                                onClick={() => setDocTarget({ name: d.name, path: d.path })}
                              >
                                <Eye className="mr-1 size-3" /> {d.name}
                              </Button>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </Card>
          </>
        )}

        <DocumentViewerDialog target={docTarget} onClose={() => setDocTarget(null)} />
      </div>
    </div>
  );
}
