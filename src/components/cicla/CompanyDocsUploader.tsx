import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Check, FileText, Loader2, Upload, X } from "lucide-react";
import { docSpecs, type UploadedDoc } from "@/lib/company-docs";

/**
 * Checklist di upload dei documenti obbligatori dell'ente.
 * Ogni slot corrisponde a un documento richiesto: il file viene caricato su
 * storage sotto `{companyId}/initial/` e restituito al chiamante.
 */
export function CompanyDocsUploader({
  companyId,
  kind,
  docs,
  onChange,
}: {
  companyId: string;
  kind: string;
  docs: UploadedDoc[];
  onChange: (docs: UploadedDoc[]) => void;
}) {
  const specs = docSpecs(kind);
  const [busy, setBusy] = useState<string | null>(null);

  async function upload(specKey: string, file: File | null | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Il file supera i 10MB");
      return;
    }
    setBusy(specKey);
    try {
      const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
      const path = `${companyId}/initial/${specKey}-${Date.now()}-${safe}`;
      const isPdf = /\.pdf$/i.test(file.name);
      const { error } = await supabase.storage.from("company-docs").upload(path, file, {
        contentType: file.type || (isPdf ? "application/pdf" : "application/octet-stream"),
        upsert: false,
      });
      if (error) {
        toast.error(`Upload fallito: ${file.name}`, { description: error.message });
        return;
      }
      const next = docs.filter((d) => d.doc_key !== specKey);
      next.push({
        name: `${specKey}-${file.name}`,
        path,
        size: file.size,
        content_type: file.type,
        doc_key: specKey,
      });
      onChange(next);
      toast.success("Documento caricato");
    } finally {
      setBusy(null);
    }
  }

  async function remove(doc: UploadedDoc) {
    await supabase.storage.from("company-docs").remove([doc.path]);
    onChange(docs.filter((d) => d.path !== doc.path));
  }

  return (
    <ul className="space-y-2.5">
      {specs.map((spec) => {
        const uploaded = docs.find((d) => d.doc_key === spec.key);
        return (
          <li
            key={spec.key}
            className={`rounded-lg border p-3 transition ${
              uploaded ? "border-cicla/40 bg-cicla/5" : "border-border/60 bg-card"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${
                  uploaded ? "bg-cicla/20 text-cicla" : "bg-secondary text-muted-foreground"
                }`}
              >
                {uploaded ? <Check className="size-3" /> : <Upload className="size-3" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium">{spec.label}</span>
                  <Badge variant="secondary" className="text-[9px]">
                    {spec.required ? "Obbligatorio" : "Facoltativo"}
                  </Badge>
                </div>
                <div className="text-[11px] leading-snug text-muted-foreground">{spec.hint}</div>

                {uploaded ? (
                  <div className="mt-2 flex items-center gap-2 rounded-md border border-border/50 bg-background/60 px-2 py-1.5">
                    <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-[11px]">{uploaded.name}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="ml-auto size-6"
                      onClick={() => remove(uploaded)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border/70 bg-secondary/30 px-3 py-2 text-[12px] text-muted-foreground hover:bg-secondary/50">
                    {busy === spec.key ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Upload className="size-3.5" />
                    )}
                    <span>{busy === spec.key ? "Caricamento…" : "Seleziona file (PDF o immagine)"}</span>
                    <Input
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      disabled={busy !== null}
                      onChange={(e) => {
                        void upload(spec.key, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
