import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { renderDecisionEmailPreview } from "@/lib/email-preview.functions";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Check, X } from "lucide-react";

export type DecisionPreviewTarget = {
  id: string;
  name: string;
  decision: "approved" | "rejected";
  reason?: string;
};

export function DecisionEmailPreview({
  target,
  busy,
  onClose,
  onConfirm,
}: {
  target: DecisionPreviewTarget | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (t: DecisionPreviewTarget) => void;
}) {
  const renderPreview = useServerFn(renderDecisionEmailPreview);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    html: string;
    subject: string;
    recipient: string;
    decidedAt: string;
    reason: string | null;
    nextStep: string;
  } | null>(null);

  useEffect(() => {
    if (!target) {
      setData(null);
      setError(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    renderPreview({
      data: {
        company_id: target.id,
        decision: target.decision,
        reason: target.reason ?? null,
        app_url: window.location.origin,
      },
    })
      .then((res) => {
        if (alive) setData(res as typeof data);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : "Anteprima non disponibile");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id, target?.decision, target?.reason]);

  const approved = target?.decision === "approved";

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-4" />
            Anteprima email · {target?.name}
          </DialogTitle>
          <DialogDescription>
            Controlla data, motivazione e prossimo passo prima di inviare l'esito all'ente.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Genero l'anteprima…
          </div>
        )}

        {error && !loading && (
          <p className="rounded bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{error}</p>
        )}

        {data && !loading && (
          <div className="space-y-3">
            <dl className="grid grid-cols-1 gap-1.5 rounded-md border border-border/60 p-3 text-[11px]">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Destinatario</dt>
                <dd className="truncate font-medium">{data.recipient}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Oggetto</dt>
                <dd className="truncate font-medium">{data.subject}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Data decisione</dt>
                <dd className="font-medium">
                  {new Date(data.decidedAt).toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" })}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="shrink-0 text-muted-foreground">Motivazione</dt>
                <dd className="text-right font-medium">{data.reason?.trim() || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="shrink-0 text-muted-foreground">Prossimo passo</dt>
                <dd className="text-right font-medium">{data.nextStep}</dd>
              </div>
            </dl>

            <iframe
              title="Anteprima email di esito"
              srcDoc={data.html}
              sandbox=""
              className="h-[320px] w-full rounded-md border border-border/60 bg-white"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annulla
          </Button>
          <Button
            variant={approved ? "default" : "destructive"}
            disabled={busy || loading}
            onClick={() => target && onConfirm(target)}
          >
            {busy ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : approved ? (
              <Check className="mr-1 size-3.5" />
            ) : (
              <X className="mr-1 size-3.5" />
            )}
            {approved ? "Conferma e invia approvazione" : "Conferma rifiuto e invia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
