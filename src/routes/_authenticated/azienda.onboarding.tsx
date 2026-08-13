import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createCompany, getMyCompany, submitInitialDocuments } from "@/lib/companies.functions";
import { CompanyDocsUploader } from "@/components/cicla/CompanyDocsUploader";
import { docSpecs, type UploadedDoc } from "@/lib/company-docs";
import { CiclaLogo } from "@/components/cicla/CiclaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Building2, ArrowRight, ShieldCheck, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/azienda/onboarding")({
  ssr: false,
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const getMine = useServerFn(getMyCompany);
  const create = useServerFn(createCompany);
  const submitDocs = useServerFn(submitInitialDocuments);
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(true);
  const [kind, setKind] = useState<"company" | "municipality">("company");
  const [created, setCreated] = useState<{ id: string; kind: string; name: string } | null>(null);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
  }, []);

  const { data: existing, isLoading: checking } = useQuery({
    queryKey: ["my-company"],
    queryFn: () => getMine({}),
    enabled: hasSession === true,
    retry: false,
  });

  useEffect(() => {
    if (existing && !created) navigate({ to: "/azienda" as never });
  }, [existing, created, navigate]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const vat = String(fd.get("vat") || "").trim();
    const iban = String(fd.get("iban") || "").trim();
    const contact_email = String(fd.get("contact_email") || "").trim();

    if (!hasSession) {
      toast.info("Anteprima attiva: accedi per salvare davvero questi dati.");
      return;
    }

    if (name.length < 2) return toast.error(kind === "municipality" ? "Inserisci il nome del Comune" : "Inserisci la ragione sociale");
    if (vat.length < 4) return toast.error(kind === "municipality" ? "Inserisci il codice fiscale del Comune" : "Inserisci la partita IVA o il codice fiscale");
    if (!contact_email) return toast.error("Inserisci un'email di contatto");

    setLoading(true);
    try {
      const company = await create({ data: { name, vat, iban, contact_email, kind } });
      setCreated({ id: company.id, kind: company.kind, name: company.name });
      toast.success("Dati salvati. Ora carica i documenti obbligatori.");
    } catch (err) {
      toast.error((err as Error)?.message ?? "Errore creazione");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitDocs() {
    if (!created) return;
    const required = docSpecs(created.kind).filter((s) => s.required);
    const missing = required.filter((s) => !docs.some((d) => d.doc_key === s.key));
    if (missing.length > 0) {
      toast.error(`Mancano ${missing.length} documenti obbligatori`, {
        description: missing.map((m) => m.label).join(", "),
      });
      return;
    }
    setLoading(true);
    try {
      await submitDocs({ data: { notes: notes.trim() || undefined, documents: docs.map(({ doc_key: _k, ...d }) => d) } });
      toast.success("Richiesta inviata: la verifica richiede di norma 24–48h.", { duration: 8000 });
      await router.invalidate();
      navigate({ to: "/azienda" as never });
    } catch (err) {
      toast.error((err as Error)?.message ?? "Errore invio documenti");
    } finally {
      setLoading(false);
    }
  }

  if (hasSession === null || (hasSession && checking && !created)) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isMuni = kind === "municipality";
  const step = created ? 2 : 1;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/40 to-background">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-5 py-8">
        <CiclaLogo size="md" />

        <div className="mt-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-cicla/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cicla">
            <Building2 size={12} /> Onboarding · passo {step} di 2
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">
            {step === 1 ? "Registra il tuo ente" : "Carica i documenti obbligatori"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === 1
              ? `Scegli il tipo di ente: i dati appariranno sulla tua fattura e servono per la verifica prima di poter accogliere i tuoi ${isMuni ? "cittadini" : "dipendenti"}.`
              : "Tutti i documenti elencati sono necessari per la verifica. Senza documenti completi la richiesta non può essere approvata."}
          </p>
        </div>

        {step === 1 && (
          <>
            {/* Kind selector */}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKind("company")}
                className={`rounded-2xl border p-3 text-left transition-colors ${
                  kind === "company" ? "border-cicla bg-cicla/10" : "border-border/60 bg-card"
                }`}
              >
                <div className="text-sm font-semibold">Azienda</div>
                <div className="text-[11px] text-muted-foreground">Premia i dipendenti</div>
              </button>
              <button
                type="button"
                onClick={() => setKind("municipality")}
                className={`rounded-2xl border p-3 text-left transition-colors ${
                  kind === "municipality" ? "border-cicla bg-cicla/10" : "border-border/60 bg-card"
                }`}
              >
                <div className="text-sm font-semibold">Comune</div>
                <div className="text-[11px] text-muted-foreground">Premia i cittadini</div>
              </button>
            </div>

            <Card className="mt-4 border-border/60 p-6 shadow-cicla">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{isMuni ? "Nome del Comune *" : "Ragione sociale *"}</Label>
                  <Input id="name" name="name" required maxLength={120} placeholder={isMuni ? "es. Comune di Bologna" : ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vat">{isMuni ? "Codice fiscale del Comune *" : "Partita IVA / Codice fiscale *"}</Label>
                  <Input id="vat" name="vat" required maxLength={32} placeholder={isMuni ? "00000000000" : "IT01234567890"} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="iban">IBAN <span className="text-muted-foreground">(opzionale)</span></Label>
                  <Input id="iban" name="iban" maxLength={34} className="uppercase" placeholder="IT60X0542811101000000123456" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Email di contatto *</Label>
                  <Input id="contact_email" name="contact_email" type="email" required />
                </div>
                <Button type="submit" className="h-11 w-full" disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <>Continua <ArrowRight className="ml-1 size-4" /></>}
                </Button>
              </form>
            </Card>
          </>
        )}

        {step === 2 && created && (
          <>
            <Card className="mt-5 border-border/60 p-5">
              <CompanyDocsUploader
                companyId={created.id}
                kind={created.kind}
                docs={docs}
                onChange={setDocs}
              />

              <div className="mt-4 space-y-2">
                <Label htmlFor="notes" className="text-xs">Note per l'admin (opzionale)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Es. la visura è stata emessa il mese scorso…"
                />
              </div>

              <Button className="mt-4 h-11 w-full" onClick={handleSubmitDocs} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <><ShieldCheck className="mr-1 size-4" /> Invia richiesta di verifica</>}
              </Button>
            </Card>

            <div className="mt-4 flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/40 p-3 text-[11px] leading-snug text-muted-foreground">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Il <strong>codice ente</strong> viene generato e mostrato nella tua area personale
                solo dopo l'approvazione dell'admin: da quel momento potrai distribuirlo
                ai tuoi {created.kind === "municipality" ? "cittadini" : "dipendenti"}.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
