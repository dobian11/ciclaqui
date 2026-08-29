import { createFileRoute, Link } from "@tanstack/react-router";
import { PoweredBy } from "@/components/cicla/PoweredBy";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bike,
  Plus,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  X,
  Copy,
  Share2,
  Wallet,
  History,
  MapPin,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  Camera,
  Info,
  Paperclip,
  Trash2,
  FileDown,
} from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyBikes,
  createBike,
  reportStolen,
  markRecovered,
  checkFrameNumber,
  listReportsForMyBike,
} from "@/lib/bikes.functions";
import { getGoogleWalletLink, getAppleWalletPass } from "@/lib/wallet.functions";
import { confirmDialog as confirm } from "@/components/cicla/ConfirmDialog";
import { useViewportBottomInset } from "@/hooks/use-keyboard-inset";
import { friendlyMessage } from "@/lib/error-message";

export const Route = createFileRoute("/_authenticated/app/bici")({
  component: BiciPage,
});

type BikeRow = Awaited<ReturnType<typeof listMyBikes>>[number];
type ReportRow = Awaited<ReturnType<typeof listReportsForMyBike>>[number];

/** Stato leggibile della bici: badge coerente in card e dettagli. */
const STATUS_META: Record<
  string,
  { label: string; chip: string; description: string }
> = {
  libera: {
    label: "Registrata",
    chip: "bg-cicla/15 text-cicla",
    description: "La bici è registrata a tuo nome e non risultano segnalazioni.",
  },
  custodita: {
    label: "Registrata · custodita",
    chip: "bg-cicla/15 text-cicla",
    description: "La bici è registrata a tuo nome ed è al sicuro.",
  },
  rubata: {
    label: "Furto segnalato",
    chip: "bg-destructive/20 text-destructive",
    description:
      "La segnalazione è attiva e visibile nel registro pubblico delle bici rubate.",
  },
  recuperata: {
    label: "Recuperata",
    chip: "bg-sky-500/15 text-sky-400",
    description: "La bici è stata contrassegnata come recuperata.",
  },
};

function statusMeta(status: string) {
  return (
    STATUS_META[status] ?? {
      label: status,
      chip: "bg-muted text-muted-foreground",
      description: "",
    }
  );
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const FRAME_RE = /^[A-Z0-9][A-Z0-9-]{2,39}$/;

/** Prove furto: formati accettati, dimensione e numero massimo per file. */
const EVIDENCE_TYPES: Record<string, "image" | "pdf"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "application/pdf": "pdf",
};
const EVIDENCE_MAX_FILES = 3;
const EVIDENCE_MAX_BYTES = 8 * 1024 * 1024;

type EvidenceItem = {
  path: string;
  name: string;
  kind: "image" | "pdf";
  previewUrl?: string;
};

function BiciPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyBikes);
  const [hasSession, setHasSession] = useState<boolean | null>(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
  }, []);

  const { data: bikes = [], isLoading } = useQuery({
    queryKey: ["my-bikes"],
    queryFn: () => listFn(),
    enabled: hasSession === true,
  });

  const [showAdd, setShowAdd] = useState(false);
  const [showQr, setShowQr] = useState<BikeRow | null>(null);
  const [showDetails, setShowDetails] = useState<BikeRow | null>(null);
  const [showTheft, setShowTheft] = useState<BikeRow | null>(null);

  if (hasSession === false) {
    return (
      <div className="app-page bg-background">
        <div className="app-container py-4 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Le tue bici</h1>
          <PoweredBy className="mt-0.5" />
          <p className="mt-2 text-sm text-muted-foreground">
            Accedi per registrare il passaporto delle tue bici.
          </p>
          <Link
            to="/auth"
            className="mt-6 inline-flex rounded-full bg-cicla px-5 py-2.5 text-sm font-semibold text-cicla-foreground"
          >
            Accedi
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page bg-background">
      <div className="app-container py-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Passaporto bici</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Identità digitale e segnalazione furto della tua bici.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-cicla px-4 py-2 text-sm font-semibold text-cicla-foreground shadow-lg shadow-cicla/20"
          >
            <Plus size={16} /> Aggiungi
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {isLoading && (
            <div className="rounded-2xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
              Caricamento…
            </div>
          )}
          {!isLoading && bikes.length === 0 && (
            <div className="grid place-items-center rounded-3xl border border-dashed border-border bg-card/40 p-10 text-center">
              <div className="grid size-16 place-items-center rounded-full bg-cicla/10 text-cicla">
                <Bike size={28} />
              </div>
              <h2 className="mt-4 font-display text-lg font-semibold">Nessuna bici ancora</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Registra la tua prima bici con il codice del telaio.
              </p>
            </div>
          )}
          {bikes.map((b) => (
            <BikeCard
              key={b.id}
              bike={b}
              onShowQr={() => setShowQr(b)}
              onShowDetails={() => setShowDetails(b)}
              onReportTheft={() => setShowTheft(b)}
              onChange={() => qc.invalidateQueries({ queryKey: ["my-bikes"] })}
            />
          ))}
        </div>
      </div>

      {showAdd && (
        <AddBikeModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            qc.invalidateQueries({ queryKey: ["my-bikes"] });
          }}
        />
      )}
      {showQr && <QrModal bike={showQr} onClose={() => setShowQr(null)} />}
      {showDetails && (
        <BikeDetailsSheet bike={showDetails} onClose={() => setShowDetails(null)} />
      )}
      {showTheft && (
        <ReportTheftWizard
          bike={showTheft}
          onClose={() => setShowTheft(null)}
          onReported={() => {
            setShowTheft(null);
            qc.invalidateQueries({ queryKey: ["my-bikes"] });
          }}
        />
      )}
    </div>
  );
}

function BikeCard({
  bike,
  onShowQr,
  onShowDetails,
  onReportTheft,
  onChange,
}: {
  bike: BikeRow;
  onShowQr: () => void;
  onShowDetails: () => void;
  onReportTheft: () => void;
  onChange: () => void;
}) {
  const recoverFn = useServerFn(markRecovered);

  const recoverMut = useMutation({
    mutationFn: () => recoverFn({ data: { bike_id: bike.id } }),
    onSuccess: () => {
      toast.success("Bici contrassegnata come recuperata");
      onChange();
    },
    onError: (e: Error) => toast.error(friendlyMessage(e)),
  });

  const isStolen = bike.status === "rubata";
  const meta = statusMeta(bike.status);

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isStolen
          ? "border-destructive/40 bg-destructive/5"
          : "border-border bg-card/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-semibold">{bike.marca}</h3>
            {bike.modello && (
              <span className="text-sm text-muted-foreground">· {bike.modello}</span>
            )}
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Telaio: <span className="text-foreground">{bike.frame_number}</span>
          </p>
          {bike.colore && (
            <p className="text-xs text-muted-foreground">Colore: {bike.colore}</p>
          )}
          {isStolen && bike.stolen_at && (
            <p className="mt-1 text-xs text-destructive">
              Segnalata il {formatDate(bike.stolen_at)}
              {bike.stolen_place ? ` · ${bike.stolen_place}` : ""}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${meta.chip}`}
        >
          {meta.label}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onShowDetails}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold"
        >
          <History size={14} /> Stato e storico
        </button>
        <button
          type="button"
          onClick={onShowQr}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold"
        >
          <QrCode size={14} /> QR passaporto
        </button>
        {isStolen ? (
          <button
            type="button"
            onClick={async () => {
              const c = await confirm({
                title: "Segnare questa bici come recuperata?",
                description: "La segnalazione di furto verrà chiusa.",
                confirmLabel: "Sì, recuperata",
              });
              if (c.ok) recoverMut.mutate();
            }}
            disabled={recoverMut.isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-cicla/15 px-3 py-1.5 text-xs font-semibold text-cicla disabled:opacity-50"
          >
            <ShieldCheck size={14} /> Segna come recuperata
          </button>
        ) : (
          <button
            type="button"
            onClick={onReportTheft}
            className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1.5 text-xs font-semibold text-destructive"
          >
            <ShieldAlert size={14} /> Segnala furto
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Scheda dettagli: stato chiaro, verifica documenti, prove e storico        */
/* ------------------------------------------------------------------------ */

function BikeDetailsSheet({ bike, onClose }: { bike: BikeRow; onClose: () => void }) {
  const reportsFn = useServerFn(listReportsForMyBike);
  const meta = statusMeta(bike.status);
  const [exporting, setExporting] = useState(false);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["bike-reports", bike.id],
    queryFn: () => reportsFn({ data: { bike_id: bike.id } }),
  });

  // Gli avvistamenti della community escludono l'evento "[FURTO]" del proprietario.
  const sightings = reports.filter((r) => !(r.note ?? "").startsWith("[FURTO]"));

  type TimelineItem = {
    icon: React.ReactNode;
    title: string;
    when: string | null;
    detail?: string;
    tone: "ok" | "warn" | "info";
  };

  const timeline: TimelineItem[] = [
    {
      icon: <Bike size={14} />,
      title: "Bici registrata",
      when: bike.created_at,
      detail: `Passaporto creato con telaio ${bike.frame_number}`,
      tone: "ok",
    },
  ];
  if (bike.status === "rubata" && bike.stolen_at) {
    timeline.push({
      icon: <ShieldAlert size={14} />,
      title: "Furto segnalato",
      when: bike.stolen_at,
      detail: [
        bike.stolen_place ? `Luogo: ${bike.stolen_place}` : null,
        bike.stolen_note ? `Note: ${bike.stolen_note}` : null,
        bike.stolen_evidence?.length
          ? `Prove allegate: ${bike.stolen_evidence.length} file`
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Segnalazione pubblicata nel registro pubblico",
      tone: "warn",
    });
  }
  if (bike.status === "recuperata") {
    timeline.push({
      icon: <ShieldCheck size={14} />,
      title: "Bici recuperata",
      when: bike.updated_at,
      detail: "La segnalazione di furto è stata chiusa",
      tone: "info",
    });
  }

  async function exportPdf() {
    setExporting(true);
    try {
      const file = await buildBikePdf({
        bike,
        statusLabel: meta.label,
        timeline,
        sightings,
      });
      await shareOrDownloadPdf(file);
      toast.success("PDF pronto");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        toast.error(friendlyMessage(e));
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1200] grid place-items-end overflow-hidden bg-black/60 backdrop-blur-sm sm:place-items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[calc(100dvh-3rem)] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card sm:rounded-3xl"
        style={{ marginBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="font-display text-lg font-semibold">Stato del passaporto</h2>
          <button
            type="button"
            aria-label="Chiudi"
            onClick={onClose}
            className="grid min-h-11 min-w-11 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 overscroll-contain sm:px-6">
          {/* Stato attuale */}
          <div
            className={`rounded-2xl border p-4 ${
              bike.status === "rubata"
                ? "border-destructive/40 bg-destructive/10"
                : "border-border bg-background/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${meta.chip}`}>
                {meta.label}
              </span>
            </div>
            <h3 className="mt-2 font-display text-lg font-semibold">
              {bike.marca} {bike.modello ?? ""}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
            {bike.photo_url && (
              <img
                src={bike.photo_url}
                alt={`Foto di ${bike.marca}`}
                className="mt-3 h-32 w-full rounded-xl object-cover"
                loading="lazy"
              />
            )}
          </div>

          {/* Dettagli */}
          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Info size={13} /> Dettagli
            </h3>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-border bg-background/50 p-3">
                <dt className="text-[11px] text-muted-foreground">Telaio</dt>
                <dd className="font-mono text-xs">{bike.frame_number}</dd>
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-3">
                <dt className="text-[11px] text-muted-foreground">Colore</dt>
                <dd className="text-xs">{bike.colore ?? "—"}</dd>
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-3">
                <dt className="text-[11px] text-muted-foreground">Registrata il</dt>
                <dd className="text-xs">{formatDate(bike.created_at)}</dd>
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-3">
                <dt className="text-[11px] text-muted-foreground">Ultimo aggiornamento</dt>
                <dd className="text-xs">{formatDate(bike.updated_at)}</dd>
              </div>
            </dl>
          </section>

          {/* Verifica identità */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Verifica identità
            </h3>
            <div className="mt-2 space-y-2">
              <DocRow
                icon={<Camera size={14} />}
                label="Foto della bici"
                ok={Boolean(bike.photo_url)}
              />
              <DocRow
                icon={<FileText size={14} />}
                label="Ricevuta o prova d'acquisto"
                ok={Boolean(bike.receipt_url)}
              />
            </div>
            {(!bike.photo_url || !bike.receipt_url) && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Più documenti carichi, più è facile dimostrare la proprietà in caso di
                furto o recupero.
              </p>
            )}
          </section>

          {/* Prove allegate alla segnalazione di furto */}
          {bike.stolen_evidence && bike.stolen_evidence.length > 0 && (
            <EvidenceSection paths={bike.stolen_evidence} />
          )}

          {/* Storico */}
          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <History size={13} /> Storico
            </h3>
            <ol className="mt-3 space-y-0">
              {timeline.map((t, i) => (
                <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < timeline.length - 1 && (
                    <span className="absolute left-[13px] top-7 h-full w-px bg-border" />
                  )}
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full ${
                      t.tone === "warn"
                        ? "bg-destructive/15 text-destructive"
                        : t.tone === "info"
                          ? "bg-sky-500/15 text-sky-400"
                          : "bg-cicla/15 text-cicla"
                    }`}
                  >
                    {t.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{t.title}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(t.when)}</p>
                    {t.detail && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{t.detail}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {/* Avvistamenti community */}
            <div className="mt-4 rounded-2xl border border-border bg-background/50 p-3">
              <p className="text-xs font-semibold">
                Avvistamenti della community ({isLoading ? "…" : sightings.length})
              </p>
              {sightings.length === 0 && !isLoading && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Nessun avvistamento ricevuto finora.
                </p>
              )}
              <ul className="mt-2 space-y-2">
                {sightings.map((r: ReportRow) => (
                  <li key={r.id} className="rounded-xl bg-card/60 p-2.5 text-xs">
                    <p className="text-muted-foreground">{formatDate(r.created_at)}</p>
                    <p className="mt-0.5">{r.note}</p>
                    {r.lat != null && r.lng != null && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-cicla">
                        <MapPin size={11} /> Posizione allegata
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        {/* Export PDF */}
        <div className="shrink-0 border-t border-border bg-card px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:px-6">
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={exporting || isLoading}
            className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-full bg-foreground text-sm font-semibold text-background disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FileDown size={16} />
            )}
            {exporting ? "Preparazione PDF…" : "Esporta scheda in PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DocRow({
  icon,
  label,
  ok,
}: {
  icon: React.ReactNode;
  label: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-background/50 px-3 py-2.5">
      <span className="flex items-center gap-2 text-xs font-medium">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </span>
      {ok ? (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-cicla">
          <CheckCircle2 size={13} /> Caricato
        </span>
      ) : (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400">
          <AlertTriangle size={13} /> Mancante
        </span>
      )}
    </div>
  );
}

/** Anteprime delle prove dal bucket privato bike-evidence (signed URL 1h). */
function EvidenceSection({ paths }: { paths: string[] }) {
  const { data: items = [] } = useQuery({
    queryKey: ["bike-evidence-urls", paths],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("bike-evidence")
        .createSignedUrls(paths, 3600);
      if (error) throw error;
      return (data ?? [])
        .map((d, i) => ({ path: paths[i], url: d.signedUrl ?? "" }))
        .filter((d) => d.url.length > 0);
    },
    staleTime: 1000 * 60 * 45,
  });

  return (
    <section>
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Paperclip size={13} /> Prove allegate ({paths.length})
      </h3>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {items.map((e, i) =>
          e.path.toLowerCase().endsWith(".pdf") ? (
            <a
              key={e.path}
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-20 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-background/50 text-[11px] font-medium"
            >
              <FileText size={18} className="text-muted-foreground" /> Documento {i + 1}
            </a>
          ) : (
            <a
              key={e.path}
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block h-20 overflow-hidden rounded-xl border border-border"
            >
              <img
                src={e.url}
                alt={`Prova ${i + 1}`}
                className="size-full object-cover"
                loading="lazy"
              />
            </a>
          ),
        )}
        {items.length === 0 && (
          <p className="col-span-3 text-[11px] text-muted-foreground">
            Caricamento anteprime…
          </p>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Export PDF della scheda "Stato e storico"                                 */
/* ------------------------------------------------------------------------ */

type PdfTimelineItem = { title: string; when: string | null; detail?: string };

async function buildBikePdf(opts: {
  bike: BikeRow;
  statusLabel: string;
  timeline: PdfTimelineItem[];
  sightings: ReportRow[];
}): Promise<File> {
  const { bike, statusLabel, timeline, sightings } = opts;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 48;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };
  const heading = (text: string) => {
    ensureSpace(26);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 22);
    doc.text(text, margin, y);
    y += 18;
  };
  const row = (label: string, value: string) => {
    const lines = doc.splitTextToSize(value || "—", maxW - 140) as string[];
    ensureSpace(14 * lines.length + 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(110, 110, 118);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 20, 22);
    doc.text(lines, margin + 140, y);
    y += 14 * lines.length + 2;
  };
  const para = (text: string) => {
    const lines = doc.splitTextToSize(text, maxW) as string[];
    ensureSpace(12 * lines.length + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 22);
    doc.text(lines, margin, y);
    y += 12 * lines.length + 4;
  };

  // Header brand
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(22, 163, 74); // verde Cicla
  doc.text("Cicla Qui", margin, y);
  const brandW = doc.getTextWidth("Cicla Qui");
  doc.setTextColor(20, 20, 22);
  doc.text("  ·  Passaporto bici", margin + brandW, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 128);
  doc.text(
    `Documento generato il ${new Date().toLocaleString("it-IT")} · https://ciclaqui.it`,
    margin,
    y,
  );
  y += 20;
  doc.setDrawColor(228, 228, 231);
  doc.line(margin, y, pageW - margin, y);
  y += 22;

  heading(`${bike.marca} ${bike.modello ?? ""}`.trim());
  row("Stato", statusLabel);
  row("Numero telaio", bike.frame_number);
  row("Colore", bike.colore ?? "—");
  row("Registrata il", formatDate(bike.created_at));

  if (bike.status === "rubata") {
    y += 8;
    heading("Segnalazione furto");
    row("Segnalata il", formatDate(bike.stolen_at));
    row("Luogo", bike.stolen_place ?? "—");
    if (bike.stolen_note) row("Note", bike.stolen_note);
    row(
      "Prove allegate",
      bike.stolen_evidence?.length ? `${bike.stolen_evidence.length} file` : "Nessuna",
    );
  }

  y += 8;
  heading("Storico");
  for (const t of timeline) {
    ensureSpace(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 22);
    doc.text(`- ${t.title} — ${formatDate(t.when)}`, margin, y);
    y += 13;
    if (t.detail) {
      const lines = doc.splitTextToSize(t.detail, maxW - 12) as string[];
      ensureSpace(12 * lines.length + 2);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(90, 90, 96);
      doc.text(lines, margin + 12, y);
      y += 12 * lines.length + 2;
    }
  }

  y += 8;
  heading(`Avvistamenti della community (${sightings.length})`);
  if (sightings.length === 0) para("Nessun avvistamento ricevuto finora.");
  for (const s of sightings.slice(0, 20)) {
    para(`${formatDate(s.created_at)} — ${s.note ?? ""}`);
  }

  ensureSpace(40);
  y += 8;
  doc.setFontSize(8.5);
  doc.setTextColor(140, 140, 148);
  doc.text(
    `Verifica pubblica: https://ciclaqui.it/cerca-bici?telaio=${encodeURIComponent(bike.frame_number)}`,
    margin,
    y,
  );

  const blob = doc.output("blob");
  return new File([blob], `passaporto-${bike.frame_number}.pdf`, {
    type: "application/pdf",
  });
}

/** Condivide il PDF via foglio di condivisione nativo; fallback: download. */
async function shareOrDownloadPdf(file: File) {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
  };
  if (nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], title: "Passaporto bici" });
    return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ------------------------------------------------------------------------ */
/* Wizard guidato segnalazione furto: dove → quando → prove → conferma      */
/* ------------------------------------------------------------------------ */

function ReportTheftWizard({
  bike,
  onClose,
  onReported,
}: {
  bike: BikeRow;
  onClose: () => void;
  onReported: () => void;
}) {
  const reportFn = useServerFn(reportStolen);
  const bottomInset = useViewportBottomInset();
  const keyboardOpen = bottomInset > 150;

  const [step, setStep] = useState(0);
  const [place, setPlace] = useState("");
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});
  const [locating, setLocating] = useState(false);
  const [when, setWhen] = useState(() => {
    // default: adesso, in formato datetime-local
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [note, setNote] = useState("");

  // --- Prove: upload validato nel bucket privato bike-evidence ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  async function onEvidenceSelected(files: FileList | null) {
    if (!files || !userId) return;
    let count = evidence.length;
    for (const file of Array.from(files)) {
      const kind = EVIDENCE_TYPES[file.type];
      if (!kind) {
        toast.error(`"${file.name}": formato non supportato (usa JPG, PNG, WEBP o PDF).`);
        continue;
      }
      if (file.size > EVIDENCE_MAX_BYTES) {
        toast.error(`"${file.name}" supera il limite di 8 MB.`);
        continue;
      }
      if (count >= EVIDENCE_MAX_FILES) {
        toast.error(`Puoi allegare al massimo ${EVIDENCE_MAX_FILES} file.`);
        break;
      }
      const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
      const path = `${userId}/${bike.id}/${crypto.randomUUID()}.${ext}`;
      setUploading(true);
      const { error } = await supabase.storage
        .from("bike-evidence")
        .upload(path, file, { contentType: file.type });
      setUploading(false);
      if (error) {
        toast.error(`Caricamento di "${file.name}" non riuscito. Riprova.`);
        continue;
      }
      count += 1;
      setEvidence((prev) => [
        ...prev,
        {
          path,
          name: file.name,
          kind,
          previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
        },
      ]);
    }
  }

  async function removeEvidence(item: EvidenceItem) {
    setEvidence((prev) => prev.filter((e) => e.path !== item.path));
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    await supabase.storage.from("bike-evidence").remove([item.path]);
  }

  const whenDate = new Date(when);
  const whenValid = !Number.isNaN(whenDate.getTime()) && whenDate.getTime() <= Date.now();
  const placeValid = place.trim().length >= 3 || coords.lat != null;

  const mut = useMutation({
    mutationFn: () =>
      reportFn({
        data: {
          bike_id: bike.id,
          lat: coords.lat,
          lng: coords.lng,
          place: place.trim() || undefined,
          when: whenDate.toISOString(),
          note: note.trim() || undefined,
          evidence: evidence.map((e) => e.path),
        },
      }),
    onSuccess: () => {
      toast.success("Furto segnalato. La bici è ora nel registro pubblico.");
      onReported();
    },
    onError: (e: Error) => toast.error(friendlyMessage(e)),
  });

  const steps = ["Dove", "Quando", "Prove", "Conferma"];

  return (
    <div
      className="fixed inset-0 z-[1200] grid place-items-end overflow-hidden bg-black/60 backdrop-blur-sm sm:place-items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card transition-[max-height,margin] duration-200 ease-out sm:rounded-3xl"
        style={{
          maxHeight: `calc(100dvh - ${bottomInset}px - ${keyboardOpen ? "1rem" : "2.5rem"})`,
          marginBottom:
            bottomInset > 0
              ? `${bottomInset + (keyboardOpen ? 8 : 12)}px`
              : "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
        }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-destructive">
              Segnala furto
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {bike.marca} {bike.modello ?? ""} · {bike.frame_number}
            </p>
          </div>
          <button
            type="button"
            aria-label="Chiudi"
            onClick={onClose}
            className="grid min-h-11 min-w-11 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex shrink-0 items-center gap-2 px-4 pt-3 sm:px-6">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 flex-col gap-1">
              <div
                className={`h-1 rounded-full ${
                  i <= step ? "bg-destructive" : "bg-muted"
                }`}
              />
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide ${
                  i <= step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {i + 1}. {s}
              </span>
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 overscroll-contain sm:px-6">
          {step === 0 && (
            <>
              <p className="text-sm font-medium">Dove è avvenuto il furto?</p>
              <input
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="Es. Stazione Centrale, rastrelliera lato est"
                maxLength={160}
                className="input-base w-full"
                autoFocus
              />
              <button
                type="button"
                disabled={locating}
                onClick={() => {
                  setLocating(true);
                  navigator.geolocation?.getCurrentPosition(
                    (pos) => {
                      setCoords({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                      });
                      setLocating(false);
                    },
                    () => {
                      toast.error("Posizione non disponibile");
                      setLocating(false);
                    },
                    { timeout: 8000 },
                  );
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-2 text-xs font-semibold text-cicla disabled:opacity-50"
              >
                {locating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <MapPin size={14} />
                )}
                {coords.lat != null
                  ? "Posizione GPS allegata ✓"
                  : locating
                    ? "Rilevamento…"
                    : "Usa la mia posizione attuale"}
              </button>
              <p className="text-[11px] text-muted-foreground">
                Indica un indirizzo o allega la posizione GPS: aiuta la community a
                riconoscere la zona.
              </p>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-sm font-medium">Quando è avvenuto?</p>
              <label className="block">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock size={13} /> Data e ora del furto
                </span>
                <input
                  type="datetime-local"
                  value={when}
                  max={(() => {
                    const d = new Date();
                    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                    return d.toISOString().slice(0, 16);
                  })()}
                  onChange={(e) => setWhen(e.target.value)}
                  className="input-base mt-1 w-full"
                />
              </label>
              {!whenValid && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle size={13} /> Inserisci una data valida, non nel futuro.
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Se non lo sai con precisione, indica l'ultima volta che hai visto la bici.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm font-medium">Allega prove (facoltativo)</p>
              <p className="text-[11px] text-muted-foreground">
                Foto della bici, denuncia o scontrino: JPG, PNG, WEBP o PDF · max 8 MB ·
                fino a {EVIDENCE_MAX_FILES} file.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  void onEvidenceSelected(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || evidence.length >= EVIDENCE_MAX_FILES || !userId}
                className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background/50 py-4 text-xs font-semibold text-cicla disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Paperclip size={14} />
                )}
                {uploading ? "Caricamento in corso…" : "Carica foto o documento"}
              </button>
              {evidence.length > 0 && (
                <ul className="space-y-2">
                  {evidence.map((ev) => (
                    <li
                      key={ev.path}
                      className="flex items-center gap-2.5 rounded-xl border border-border bg-background/50 p-2"
                    >
                      {ev.kind === "image" && ev.previewUrl ? (
                        <img
                          src={ev.previewUrl}
                          alt=""
                          className="size-10 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                          <FileText size={16} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-xs">{ev.name}</span>
                      <button
                        type="button"
                        aria-label={`Rimuovi ${ev.name}`}
                        onClick={() => void removeEvidence(ev)}
                        className="grid min-h-9 min-w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm font-medium">Controlla e conferma</p>
              <dl className="space-y-2 rounded-2xl border border-border bg-background/50 p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-xs text-muted-foreground">Bici</dt>
                  <dd className="text-right text-xs font-semibold">
                    {bike.marca} {bike.modello ?? ""}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-xs text-muted-foreground">Telaio</dt>
                  <dd className="font-mono text-xs">{bike.frame_number}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-xs text-muted-foreground">Luogo</dt>
                  <dd className="text-right text-xs">
                    {place.trim() || "—"}
                    {coords.lat != null && (
                      <span className="block text-[10px] text-cicla">
                        + posizione GPS allegata
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-xs text-muted-foreground">Quando</dt>
                  <dd className="text-xs">{formatDate(whenDate.toISOString())}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-xs text-muted-foreground">Prove</dt>
                  <dd className="text-right text-xs">
                    {evidence.length ? `${evidence.length} file allegati` : "Nessuna"}
                  </dd>
                </div>
              </dl>
              <label className="block">
                <span className="text-xs text-muted-foreground">
                  Note aggiuntive (facoltative)
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Segni particolari, lucchetto tagliato, testimoni…"
                  className="input-base mt-1 w-full resize-none"
                />
              </label>
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-[11px] text-destructive">
                Confermando, la bici sarà pubblicata nel registro pubblico delle bici
                rubate e chiunque potrà segnalare un avvistamento.
              </p>
            </>
          )}
        </div>

        <div
          className="flex shrink-0 gap-2 border-t border-border bg-card px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:px-6 sm:pb-5"
          style={keyboardOpen ? { paddingBottom: "0.75rem" } : undefined}
        >
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="inline-flex min-h-12 items-center gap-1 rounded-full border border-border px-4 text-sm font-semibold"
            >
              <ChevronLeft size={16} /> Indietro
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              disabled={
                (step === 0 && !placeValid) ||
                (step === 1 && !whenValid) ||
                (step === 2 && uploading)
              }
              onClick={() => setStep(step + 1)}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-1 rounded-full bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-40"
            >
              Avanti <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              disabled={mut.isPending || uploading}
              onClick={() => mut.mutate()}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-full bg-destructive px-4 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
            >
              {mut.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ShieldAlert size={16} />
              )}
              {mut.isPending ? "Invio…" : "Conferma e segnala il furto"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Modale nuova bici con validazione telaio                                  */
/* ------------------------------------------------------------------------ */

function AddBikeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const createFn = useServerFn(createBike);
  const checkFn = useServerFn(checkFrameNumber);
  // Inset inferiore reale: toolbar iOS Safari o tastiera software.
  const bottomInset = useViewportBottomInset();
  const keyboardOpen = bottomInset > 150;
  const [form, setForm] = useState({
    marca: "",
    modello: "",
    colore: "",
    frame_number: "",
  });

  // --- Validazione numero di telaio (formato + unicità, con debounce) ---
  const frame = form.frame_number.trim().toUpperCase();
  type FrameState = "idle" | "invalid" | "checking" | "available" | "taken" | "taken-stolen";
  const [frameState, setFrameState] = useState<FrameState>("idle");

  useEffect(() => {
    if (frame.length === 0) {
      setFrameState("idle");
      return;
    }
    if (!FRAME_RE.test(frame)) {
      setFrameState("invalid");
      return;
    }
    setFrameState("checking");
    const t = window.setTimeout(async () => {
      try {
        const r = await checkFn({ data: { frame_number: frame } });
        setFrameState(
          r.available ? "available" : r.flaggedStolen ? "taken-stolen" : "taken",
        );
      } catch {
        setFrameState("idle");
      }
    }, 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame]);

  const frameBlocked =
    frameState === "invalid" ||
    frameState === "checking" ||
    frameState === "taken" ||
    frameState === "taken-stolen";

  const mut = useMutation({
    mutationFn: () => createFn({ data: form }),
    onSuccess: () => {
      toast.success("Bici registrata");
      onCreated();
    },
    onError: (e: Error) => toast.error(friendlyMessage(e)),
  });

  // Snap points stile iOS: "full" (aperto), "half" (45% nascosto) e chiusura
  // trascinando oltre la soglia. Attivi solo su mobile (su desktop il modale
  // è centrato e non si trascina). Con la tastiera aperta resta sempre "full".
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(true);
  const [snap, setSnap] = useState<"full" | "half">("full");
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (keyboardOpen) setSnap("full");
  }, [keyboardOpen]);

  const onHandlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!isMobile) return;
    setIsDragging(true);
    startY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!isDragging) return;
    const delta = e.clientY - startY.current;
    // Da "full" si può solo scendere; da "half" anche risalire.
    setDragY(snap === "half" ? delta : Math.max(0, delta));
  };
  const onHandlePointerEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const h = sheetRef.current?.offsetHeight ?? 1;
    const total = (snap === "half" ? h * 0.45 : 0) + dragY;
    if (total > h * 0.65) onClose();
    else if (total > h * 0.22) setSnap("half");
    else setSnap("full");
    setDragY(0);
  };

  // translateY in % si riferisce all'altezza del foglio stesso: 45% = snap "half".
  const minDrag = snap === "half" ? -((sheetRef.current?.offsetHeight ?? 0) * 0.45) : 0;
  const sheetTransform =
    isMobile && (snap === "half" || dragY !== 0)
      ? `translateY(calc(${snap === "half" ? "45%" : "0px"} + ${Math.max(minDrag, dragY)}px))`
      : undefined;

  // Quando la tastiera si apre, il foglio si solleva sopra di essa e il
  // campo attivo viene fatto scorrere in vista: il bottone resta raggiungibile.
  const onFieldFocus = (e: React.FocusEvent<HTMLElement>) => {
    const el = e.target;
    window.setTimeout(() => {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 320);
  };

  return (
    <div
      className="fixed inset-0 z-[1200] grid place-items-end overflow-hidden bg-black/60 backdrop-blur-sm sm:place-items-center sm:p-4"
      onClick={(e) => {
        // Tap sul backdrop: da "half" riapre a tutto schermo, da "full" chiude.
        if (e.target === e.currentTarget) {
          if (snap === "half") setSnap("full");
          else onClose();
        }
      }}
    >
      <div
        ref={sheetRef}
        className={`flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card sm:rounded-3xl ${
          isDragging ? "" : "transition-[max-height,margin,transform] duration-200 ease-out"
        }`}
        style={{
          maxHeight: `calc(100dvh - ${bottomInset}px - ${keyboardOpen ? "1rem" : "2.5rem"})`,
          marginBottom:
            bottomInset > 0
              ? `${bottomInset + (keyboardOpen ? 8 : 12)}px`
              : "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)",
          transform: sheetTransform,
        }}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2 active:cursor-grabbing sm:hidden"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerEnd}
          onPointerCancel={onHandlePointerEnd}
          aria-label="Trascina per ridimensionare o chiudere"
        >
          <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="font-display text-lg font-semibold">Nuova bici</h2>
          <button type="button" aria-label="Chiudi" onClick={onClose} className="grid min-h-11 min-w-11 place-items-center rounded-full text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!frameBlocked) mut.mutate();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div
            onFocusCapture={onFieldFocus}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 overscroll-contain sm:px-6"
          >
            <Field label="Marca *">
              <input
                required
                value={form.marca}
                onChange={(e) => setForm({ ...form, marca: e.target.value })}
                placeholder="Es. Bianchi"
                className="input-base"
              />
            </Field>
            <Field label="Modello">
              <input
                value={form.modello}
                onChange={(e) => setForm({ ...form, modello: e.target.value })}
                placeholder="Es. Aria"
                className="input-base"
              />
            </Field>
            <Field label="Colore">
              <input
                value={form.colore}
                onChange={(e) => setForm({ ...form, colore: e.target.value })}
                placeholder="Es. Verde celeste"
                className="input-base"
              />
            </Field>
            <Field label="Numero telaio *">
              <input
                required
                value={form.frame_number}
                onChange={(e) =>
                  setForm({ ...form, frame_number: e.target.value.toUpperCase() })
                }
                placeholder="WBA12345678"
                aria-invalid={frameState === "invalid" || frameState === "taken"}
                className={`input-base font-mono ${
                  frameState === "invalid" || frameState === "taken" || frameState === "taken-stolen"
                    ? "border-destructive/60"
                    : frameState === "available"
                      ? "border-cicla/60"
                      : ""
                }`}
              />
              {/* Feedback validazione telaio */}
              {frameState === "invalid" && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                  <AlertTriangle size={12} /> Usa 3-40 caratteri: lettere, numeri e trattini.
                </p>
              )}
              {frameState === "checking" && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 size={12} className="animate-spin" /> Verifica disponibilità…
                </p>
              )}
              {frameState === "available" && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-cicla">
                  <CheckCircle2 size={12} /> Telaio valido e disponibile
                </p>
              )}
              {frameState === "taken" && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                  <AlertTriangle size={12} /> Questo numero di telaio è già registrato.
                </p>
              )}
              {frameState === "taken-stolen" && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                  <ShieldAlert size={12} /> Attenzione: questo telaio risulta già registrato
                  e segnalato come rubato.
                </p>
              )}
              {frameState === "idle" && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Stampigliato sul telaio (di solito sotto il movimento centrale).
                </p>
              )}
            </Field>
          </div>
          <div
            className="shrink-0 border-t border-border bg-card px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] sm:px-6 sm:pb-6"
            style={keyboardOpen ? { paddingBottom: "0.75rem" } : undefined}
          >
            <button
              type="submit"
              disabled={mut.isPending || frameBlocked}
              className="min-h-12 w-full rounded-full bg-cicla px-4 text-sm font-semibold text-cicla-foreground disabled:opacity-50"
            >
              {mut.isPending ? "Salvataggio…" : "Registra bici"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function QrModal({ bike, onClose }: { bike: BikeRow; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const passportUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/cerca-bici?telaio=${encodeURIComponent(bike.frame_number)}`
      : "";

  useEffect(() => {
    QRCode.toDataURL(passportUrl, { width: 512, margin: 1, color: { dark: "#0c0c0e", light: "#ffffff" } })
      .then(setDataUrl)
      .catch(() => null);
  }, [passportUrl]);

  return (
    <div className="fixed inset-0 z-[1200] grid place-items-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Passaporto QR</h2>
          <button type="button" aria-label="Chiudi" onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 grid place-items-center">
          {dataUrl ? (
            <img src={dataUrl} alt="QR passaporto" className="size-56 rounded-2xl bg-white p-3" />
          ) : (
            <div className="size-56 animate-pulse rounded-2xl bg-muted" />
          )}
        </div>
        <p className="mt-3 font-mono text-xs text-muted-foreground">{bike.frame_number}</p>
        <p className="mt-1 text-xs text-muted-foreground break-all">{passportUrl}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(passportUrl);
              toast.success("Link copiato");
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold"
          >
            <Copy size={14} /> Copia
          </button>
          <button
            onClick={async () => {
              if (navigator.share) {
                try {
                  await navigator.share({ url: passportUrl, title: "Passaporto Cicla Qui" });
                } catch {
                  /* ignore */
                }
              } else {
                navigator.clipboard.writeText(passportUrl);
                toast.success("Link copiato");
              }
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-cicla px-3 py-2 text-xs font-semibold text-cicla-foreground"
          >
            <Share2 size={14} /> Condividi
          </button>
        </div>
        <WalletButtons bikeId={bike.id} />
      </div>
    </div>
  );
}

function WalletButtons({ bikeId }: { bikeId: string }) {
  const googleFn = useServerFn(getGoogleWalletLink);
  const appleFn = useServerFn(getAppleWalletPass);
  const [loading, setLoading] = useState<"google" | "apple" | null>(null);

  async function onGoogle() {
    setLoading("google");
    try {
      const res = await googleFn({ data: { bike_id: bikeId } });
      if (!res.configured) {
        toast.info("Google Wallet non ancora configurato dall'admin.");
      } else {
        window.open(res.saveUrl, "_blank", "noopener");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore Google Wallet");
    } finally {
      setLoading(null);
    }
  }

  async function onApple() {
    setLoading("apple");
    try {
      const res = await appleFn({ data: { bike_id: bikeId } });
      if (!res.configured) {
        toast.info("Apple Wallet non ancora configurato dall'admin.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore Apple Wallet");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <button
        onClick={onApple}
        disabled={loading !== null}
        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-foreground/95 px-3 py-2 text-xs font-semibold text-background disabled:opacity-50"
      >
        <Wallet size={14} /> {loading === "apple" ? "…" : "Apple Wallet"}
      </button>
      <button
        onClick={onGoogle}
        disabled={loading !== null}
        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50"
      >
        <Wallet size={14} /> {loading === "google" ? "…" : "Google Wallet"}
      </button>
    </div>
  );
}
