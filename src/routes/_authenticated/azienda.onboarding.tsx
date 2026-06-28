import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { createCompany, getMyCompany } from "@/lib/companies.functions";
import { CiclaLogo } from "@/components/cicla/CiclaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Building2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/azienda/onboarding")({
  ssr: false,
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const getMine = useServerFn(getMyCompany);
  const create = useServerFn(createCompany);
  const [loading, setLoading] = useState(false);

  const { data: existing, isLoading: checking } = useQuery({
    queryKey: ["my-company"],
    queryFn: () => getMine({}),
  });

  // Se ha già un'azienda, salta l'onboarding
  useEffect(() => {
    if (existing) navigate({ to: "/azienda" as never });
  }, [existing, navigate]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const vat = String(fd.get("vat") || "").trim();
    const iban = String(fd.get("iban") || "").trim();
    const contact_email = String(fd.get("contact_email") || "").trim();

    if (name.length < 2) return toast.error("Inserisci la ragione sociale");
    if (vat.length < 4) return toast.error("Inserisci la partita IVA o il codice fiscale");
    if (!contact_email) return toast.error("Inserisci un'email di contatto");

    setLoading(true);
    try {
      const company = await create({ data: { name, vat, iban, contact_email } });
      toast.success(`Azienda registrata! Codice: ${company.code}`, { duration: 8000 });
      await router.invalidate();
      navigate({ to: "/azienda" as never });
    } catch (err) {
      toast.error((err as Error)?.message ?? "Errore creazione azienda");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/40 to-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
        <CiclaLogo size="md" />

        <div className="mt-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-cicla/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cicla">
            <Building2 size={12} /> Onboarding azienda · passo 1 di 2
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">Registra la tua azienda</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Questi dati appariranno sulla tua fattura e ti serviranno per generare il codice da
            distribuire ai dipendenti.
          </p>
        </div>

        <Card className="mt-6 border-border/60 p-6 shadow-cicla">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Ragione sociale *</Label>
              <Input id="name" name="name" required maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat">Partita IVA / Codice fiscale *</Label>
              <Input id="vat" name="vat" required maxLength={32} placeholder="IT01234567890" />
              <p className="text-[11px] text-muted-foreground">
                Usato come codice matricola dell'azienda per la fatturazione.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="iban">IBAN <span className="text-muted-foreground">(opzionale)</span></Label>
              <Input id="iban" name="iban" maxLength={34} className="uppercase" placeholder="IT60X0542811101000000123456" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">Email di contatto *</Label>
              <Input id="contact_email" name="contact_email" type="email" required />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <>Continua <ArrowRight className="ml-1 size-4" /></>}
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Nel passo successivo riceverai il <strong>codice azienda</strong> e potrai attivare l'abbonamento mensile.
        </p>
      </div>
    </div>
  );
}
