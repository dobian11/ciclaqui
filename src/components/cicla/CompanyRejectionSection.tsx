import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DocumentViewerDialog, type DocTarget } from "@/components/cicla/DocumentViewerDialog";
import { AlertTriangle, FileText, MessageSquare, RefreshCw, Eye } from "lucide-react";

export type RejectionReview = {
  id: string;
  kind: string;
  status: string;
  reason: string | null;
  notes: string | null;
  documents: unknown;
  submitted_at: string;
  reviewed_at: string | null;
};

/**
 * Sezione "Motivo rifiuto": mostra al titolare dell'ente la motivazione
 * dell'admin, i commenti della revisione e i documenti inviati, consultabili
 * in-app senza uscire dal sito.
 */
export function CompanyRejectionSection({
  companyRejectionReason,
  reviews,
  onRequestReview,
}: {
  companyRejectionReason?: string | null;
  reviews: RejectionReview[] | undefined;
  onRequestReview?: () => void;
}) {
  const [docTarget, setDocTarget] = useState<DocTarget>(null);

  const rejected = useMemo(
    () =>
      (reviews ?? [])
        .filter((r) => r.status === "rejected")
        .sort(
          (a, b) =>
            new Date(b.reviewed_at ?? b.submitted_at).getTime() -
            new Date(a.reviewed_at ?? a.submitted_at).getTime(),
        ),
    [reviews],
  );

  const hasReason = !!companyRejectionReason?.trim();
  if (!hasReason && rejected.length === 0) return null;

  const latest = rejected[0] ?? null;
  const mainReason =
    companyRejectionReason?.trim() ||
    latest?.reason?.trim() ||
    "Nessun motivo specificato dall'admin.";

  const docsOf = (r: RejectionReview) =>
    Array.isArray(r.documents) ? (r.documents as Array<{ name: string; path: string }>) : [];

  return (
    <>
      <Card className="mt-4 border-destructive/40 bg-destructive/5 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-4" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Motivo rifiuto
            </span>
          </div>
          {latest?.reviewed_at && (
            <span className="text-[10px] text-muted-foreground">
              {new Date(latest.reviewed_at).toLocaleString("it-IT")}
            </span>
          )}
        </div>

        <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-[12px] leading-snug">
          {mainReason}
        </p>

        {rejected.length > 0 && (
          <ul className="mt-3 space-y-2.5">
            {rejected.map((r) => {
              const docs = docsOf(r);
              return (
                <li key={r.id} className="rounded-md border border-border/50 bg-card/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[12px] font-medium">
                      {r.kind === "initial" ? "Registrazione iniziale" : "Revisione"}
                    </div>
                    <Badge variant="secondary" className="bg-destructive/15 text-[10px] text-destructive">
                      Rifiutata
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    Inviata {new Date(r.submitted_at).toLocaleString("it-IT")}
                    {r.reviewed_at && (
                      <> · Esito {new Date(r.reviewed_at).toLocaleString("it-IT")}</>
                    )}
                  </div>

                  {r.reason && (
                    <div className="mt-2 rounded bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                      Motivo: {r.reason}
                    </div>
                  )}

                  {r.notes && (
                    <div className="mt-2 flex items-start gap-2 rounded bg-secondary/50 px-2 py-1.5 text-[11px]">
                      <MessageSquare className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                      <span className="leading-snug">{r.notes}</span>
                    </div>
                  )}

                  {docs.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Documenti inviati
                      </div>
                      {docs.map((d) => (
                        <button
                          key={d.path}
                          type="button"
                          onClick={() => setDocTarget({ name: d.name, path: d.path })}
                          className="flex w-full items-center gap-2 rounded border border-border/50 px-2 py-1.5 text-left text-[11px] transition hover:bg-secondary/60"
                        >
                          <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{d.name}</span>
                          <Eye className="size-3.5 shrink-0 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {onRequestReview && (
          <Button className="mt-4 w-full" onClick={onRequestReview}>
            <RefreshCw className="mr-2 size-4" /> Correggi e invia nuova richiesta
          </Button>
        )}
      </Card>

      <DocumentViewerDialog target={docTarget} onClose={() => setDocTarget(null)} />
    </>
  );
}
