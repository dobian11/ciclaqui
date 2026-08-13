import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requestCompanyReview } from "@/lib/companies.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Upload, X, FileText, Send } from "lucide-react";

type UploadedDoc = { name: string; path: string; size?: number; content_type?: string };

export function CompanyReviewDialog({
  companyId,
  open,
  onOpenChange,
  onSubmitted,
}: {
  companyId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmitted?: () => void;
}) {
  const submitFn = useServerFn(requestCompanyReview);
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const next: UploadedDoc[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name}: massimo 10MB`);
          continue;
        }
        const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
        const path = `${companyId}/draft/${Date.now()}-${safeName}`;
        const { error } = await supabase.storage.from("company-docs").upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
        if (error) {
          toast.error(`Upload fallito: ${file.name}`);
          continue;
        }
        next.push({ name: file.name, path, size: file.size, content_type: file.type });
      }
      setDocs((d) => [...d, ...next]);
      if (next.length) toast.success(`${next.length} documento/i caricati`);
    } finally {
      setUploading(false);
    }
  }

  async function removeDoc(d: UploadedDoc) {
    await supabase.storage.from("company-docs").remove([d.path]).catch(() => {});
    setDocs((cur) => cur.filter((x) => x.path !== d.path));
  }

  async function submit() {
    if (docs.length === 0 && notes.trim().length < 10) {
      toast.error("Allega almeno un documento o scrivi una nota (min. 10 caratteri)");
      return;
    }
    setSubmitting(true);
    try {
      await submitFn({ data: { notes: notes.trim() || undefined, documents: docs } });
      toast.success("Richiesta inviata all'admin", {
        description: "Riceverai una notifica appena la richiesta sarà revisionata.",
      });
      setNotes("");
      setDocs([]);
      onOpenChange(false);
      // Reset toast dedup so next dashboard load fires "in attesa" toast
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const k = sessionStorage.key(i);
          if (k?.startsWith("cicla:company-status-toast:")) sessionStorage.removeItem(k);
        }
      } catch { /* ignore */ }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-company"] }),
        qc.invalidateQueries({ queryKey: ["my-company-reviews"] }),
      ]);
      onSubmitted?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore invio richiesta");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Richiedi nuova revisione</DialogTitle>
          <DialogDescription>
            Allega documenti aggiornati (visura, statuto, atto di nomina, ecc.) e
            descrivi cosa è cambiato. La richiesta sarà notificata all'admin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="rev-notes" className="text-xs">Note per l'admin</Label>
            <Textarea
              id="rev-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Es. ho aggiornato la visura camerale e l'IBAN…"
              rows={4}
              maxLength={1000}
              className="mt-1"
            />
            <div className="mt-1 text-right text-[10px] text-muted-foreground">{notes.length}/1000</div>
          </div>

          <div>
            <Label className="text-xs">Documenti (PDF/immagini, max 10MB)</Label>
            <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border/70 bg-secondary/30 p-4 text-sm text-muted-foreground hover:bg-secondary/50">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              <span>{uploading ? "Caricamento…" : "Seleziona file"}</span>
              <Input
                type="file"
                multiple
                accept="application/pdf,image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
              />
            </label>

            {docs.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {docs.map((d) => (
                  <li key={d.path} className="flex items-center gap-2 rounded-md border border-border/50 bg-card/50 px-2 py-1.5">
                    <FileText className="size-3.5 text-muted-foreground" />
                    <span className="truncate text-[12px]">{d.name}</span>
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      {((d.size ?? 0) / 1024).toFixed(0)} KB
                    </Badge>
                    <Button size="icon" variant="ghost" aria-label={`Rimuovi documento ${d.name}`} className="size-6" onClick={() => removeDoc(d)}>
                      <X className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annulla
          </Button>
          <Button onClick={submit} disabled={submitting || uploading}>
            {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
            Invia richiesta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
