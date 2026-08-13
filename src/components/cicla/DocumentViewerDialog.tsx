import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getCompanyDocUrl } from "@/lib/companies.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, ExternalLink, FileText } from "lucide-react";

export type DocTarget = { name: string; path: string } | null;

function isImage(name: string) {
  return /\.(png|jpe?g|gif|webp|heic|avif)$/i.test(name);
}

/**
 * Visualizza un documento dell'ente direttamente nel sito (PDF in iframe,
 * immagini inline), senza aprire schede esterne.
 */
export function DocumentViewerDialog({
  target,
  onClose,
}: {
  target: DocTarget;
  onClose: () => void;
}) {
  const getUrl = useServerFn(getCompanyDocUrl);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(null);
    if (!target) return;
    getUrl({ data: { path: target.path } })
      .then((r) => { if (!cancelled) setUrl(r.url); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Errore"); });
    return () => { cancelled = true; };
  }, [target, getUrl]);

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4 shrink-0" />
            <span className="truncate">{target?.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="h-[65vh] w-full overflow-hidden rounded-md border border-border/60 bg-secondary/30">
          {!url && !error && (
            <div className="grid h-full place-items-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && (
            <div className="grid h-full place-items-center px-6 text-center text-sm text-destructive">
              {error}
            </div>
          )}
          {url && target && (
            isImage(target.name) ? (
              <div className="h-full w-full overflow-auto">
                <img src={url} alt={target.name} className="mx-auto max-w-full" />
              </div>
            ) : (
              <iframe src={url} title={target.name} className="h-full w-full" />
            )
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" asChild disabled={!url}>
            <a href={url ?? "#"} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 size-3.5" /> Apri in scheda
            </a>
          </Button>
          <Button size="sm" asChild disabled={!url}>
            <a href={url ?? "#"} download={target?.name}>
              <Download className="mr-1 size-3.5" /> Scarica
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
