import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Building2, Landmark, Hash, Mail, CreditCard, FileText, Check, Clock,
  AlertTriangle, Upload, Copy, Lock, History, RefreshCw, CalendarClock, Eye, EyeOff,
} from "lucide-react";
import { COMPANY_DOCS, MUNI_DOCS, normalizeDocName as normalize } from "@/lib/company-docs";

export type PendingCompany = {
  id: string;
  name: string;
  code: string;
  kind: string;
  vat: string | null;
  iban: string | null;
  contact_email: string | null;
  created_at: string;
  status?: string | null;
  rejection_reason?: string | null;
};

export type PendingReview = {
  id: string;
  kind: string;
  status: string;
  reason: string | null;
  notes: string | null;
  documents: unknown;
  submitted_at: string;
  reviewed_at: string | null;
};


export function PendingCompanyDashboard({
  company,
  reviews,
  onRequestReview,
}: {
  company: PendingCompany;
  reviews: PendingReview[] | undefined;
  onRequestReview: () => void;
}) {
  const [revealCode, setRevealCode] = useState(false);
  const isMuni = company.kind === "municipality";
  const isRejected = (company.status ?? "pending") === "rejected";
  const specs = isMuni ? MUNI_DOCS : COMPANY_DOCS;

  const submittedDocs = useMemo(() => {
    const out: Array<{ name: string; path: string }> = [];
    for (const r of reviews ?? []) {
      if (Array.isArray(r.documents)) {
        for (const d of r.documents as Array<{ name?: string; path?: string }>) {
          if (d?.name && d?.path) out.push({ name: d.name, path: d.path });
        }
      }
    }
    return out;
  }, [reviews]);

  const checklist = useMemo(
    () =>
      specs.map((spec) => ({
        ...spec,
        matched: submittedDocs.find((d) => spec.match.some((m) => normalize(d.name).includes(m))) ?? null,
      })),
    [specs, submittedDocs],
  );

  const requiredTotal = checklist.filter((c) => c.required).length;
  const requiredDone = checklist.filter((c) => c.required && c.matched).length;
  const progress = Math.round((requiredDone / Math.max(1, requiredTotal)) * 100);

  const latest = reviews?.[0] ?? null;
  const submittedAt = latest?.submitted_at ?? company.created_at;
  const eta = new Date(new Date(submittedAt).getTime() + 48 * 3600 * 1000);

  return (
    <div className="space-y-4">
      {/* Hero stato */}
      <Card
        className={`overflow-hidden border p-5 backdrop-blur ${
          isRejected ? "border-destructive/40 bg-destructive/5" : "border-warning/40 bg-warning/5"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground">
              {isMuni ? <Landmark className="size-4" /> : <Building2 className="size-4" />}
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                {isMuni ? "Comune" : "Azienda"}
              </span>
            </div>
            <div className="mt-1 font-display text-xl font-bold leading-tight">{company.name}</div>
          </div>
          <Badge
            variant="secondary"
            className={isRejected ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}
          >
            {isRejected ? <AlertTriangle className="mr-1 size-3" /> : <Clock className="mr-1 size-3" />}
            {isRejected ? "Rifiutato" : "In verifica"}
          </Badge>
        </div>

        {isRejected ? (
          <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-destructive">
              Motivo del rifiuto
            </div>
            <p className="mt-1 text-[12px] leading-snug">
              {company.rejection_reason?.trim() || "Nessun motivo specificato dall'admin."}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-[12px] leading-snug text-muted-foreground">
            La richiesta è in coda di verifica. Un amministratore controlla dati e documenti,
            di norma entro 24–48h. Riceverai una notifica appena la pratica sarà chiusa.
          </p>
        )}

        {/* Timeline */}
        <ol className="mt-4 space-y-3">
          <TimelineStep
            done
            title="Richiesta inviata"
            detail={new Date(submittedAt).toLocaleString("it-IT")}
          />
          <TimelineStep
            done={!isRejected}
            active={!isRejected}
            error={isRejected}
            title={isRejected ? "Verifica conclusa: rifiutata" : "Verifica in corso"}
            detail={
              isRejected
                ? latest?.reviewed_at
                  ? new Date(latest.reviewed_at).toLocaleString("it-IT")
                  : "Rivedi i documenti e reinvia"
                : `Esito stimato entro il ${eta.toLocaleDateString("it-IT")}`
            }
          />
          <TimelineStep
            title="Approvazione e attivazione codice"
            detail="Dopo l'ok admin potrai attivare l'abbonamento e distribuire il codice"
            last
          />
        </ol>

        <Button className="mt-4 w-full" onClick={onRequestReview}>
          {isRejected ? <RefreshCw className="mr-2 size-4" /> : <Upload className="mr-2 size-4" />}
          {isRejected ? "Invia nuova richiesta" : "Carica o aggiorna documenti"}
        </Button>
      </Card>

      {/* Codice ente: assegnato solo dopo l'approvazione */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Codice {isMuni ? "Comune" : "azienda"}
          </div>
          <Badge variant="secondary" className="bg-secondary/70 text-[10px] text-muted-foreground">
            <Lock className="mr-1 size-3" /> Non ancora assegnato
          </Badge>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-md border border-dashed border-border/70 bg-secondary/30 p-4">
          <Lock className="size-4 shrink-0 text-muted-foreground" />
          <p className="text-[12px] leading-snug text-muted-foreground">
            Il codice riservato al tuo ente viene generato e mostrato qui
            <strong className="text-foreground"> solo dopo l'approvazione dell'admin</strong>.
            Da quel momento potrai distribuirlo ai tuoi {isMuni ? "cittadini" : "dipendenti"}.
          </p>
        </div>
      </Card>

      {/* Documenti richiesti */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="size-4" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Documenti richiesti</span>
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {requiredDone}/{requiredTotal} obbligatori
          </span>
        </div>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-cicla transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <ul className="mt-4 space-y-2.5">
          {checklist.map((item) => (
            <li key={item.key} className="flex items-start gap-3 rounded-md border border-border/50 p-2.5">
              <span
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${
                  item.matched ? "bg-cicla/15 text-cicla" : "bg-secondary text-muted-foreground"
                }`}
              >
                {item.matched ? <Check className="size-3" /> : <Clock className="size-3" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium">{item.label}</span>
                  {!item.required && (
                    <Badge variant="secondary" className="shrink-0 text-[9px]">Facoltativo</Badge>
                  )}
                </div>
                <div className="text-[11px] leading-snug text-muted-foreground">
                  {item.matched ? `Ricevuto: ${item.matched.name}` : item.hint}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {requiredDone < requiredTotal && (
          <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
            Suggerimento: rinomina i file includendo la parola chiave (es. <em>visura.pdf</em>,{" "}
            <em>identita.pdf</em>) così vengono riconosciuti automaticamente nella checklist.
          </p>
        )}

        <Button variant="secondary" className="mt-4 w-full" onClick={onRequestReview}>
          <Upload className="mr-2 size-4" /> Carica documenti
        </Button>
      </Card>

      {/* Dati inviati */}
      <Card className="p-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Dati inviati per la verifica
        </div>
        <dl className="mt-3 space-y-2 text-sm">
          <SummaryRow icon={<Hash className="size-3.5" />} label="P.IVA / CF" value={company.vat ?? "—"} />
          <SummaryRow icon={<Mail className="size-3.5" />} label="Email referente" value={company.contact_email ?? "—"} />
          <SummaryRow icon={<CreditCard className="size-3.5" />} label="IBAN" value={company.iban ?? "—"} />
          <SummaryRow
            icon={<CalendarClock className="size-3.5" />}
            label="Registrato il"
            value={new Date(company.created_at).toLocaleDateString("it-IT")}
          />
        </dl>
      </Card>

      {/* Storico revisioni */}
      {reviews && reviews.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <History className="size-4" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Stato della verifica</span>
          </div>
          <ul className="mt-3 space-y-2">
            {reviews.map((r) => {
              const docs = Array.isArray(r.documents)
                ? (r.documents as Array<{ name: string; path: string }>)
                : [];
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
                        <span
                          key={d.path}
                          className="inline-flex items-center gap-1 rounded bg-secondary/60 px-1.5 py-0.5 text-[10px]"
                        >
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
    </div>
  );
}

function TimelineStep({
  title, detail, done, active, error, last,
}: {
  title: string;
  detail: string;
  done?: boolean;
  active?: boolean;
  error?: boolean;
  last?: boolean;
}) {
  const dot = error
    ? "border-destructive bg-destructive/20 text-destructive"
    : done
      ? "border-cicla bg-cicla/20 text-cicla"
      : "border-border bg-secondary text-muted-foreground";
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={`grid size-5 place-items-center rounded-full border ${dot}`}>
          {error ? <AlertTriangle className="size-3" /> : done ? <Check className="size-3" /> : <Clock className="size-3" />}
        </span>
        {!last && <span className="mt-1 w-px flex-1 bg-border/60" />}
      </div>
      <div className="pb-1">
        <div className={`text-[13px] font-medium ${active ? "text-foreground" : ""}`}>{title}</div>
        <div className="text-[11px] leading-snug text-muted-foreground">{detail}</div>
      </div>
    </li>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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
