import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { joinCompanyByCode } from "@/lib/companies.functions";
import { CiclaLogo } from "@/components/cicla/CiclaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Building2, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/collega")({
  head: () => ({
    meta: [
      { title: "Collega il tuo ente · Cicla Qui" },
      {
        name: "description",
        content:
          "Inserisci il codice della tua azienda o del tuo Comune per attivare punti e premi su Cicla Qui.",
      },
      { property: "og:title", content: "Collega il tuo ente · Cicla Qui" },
      {
        property: "og:description",
        content: "Attiva il tuo account Cicla Qui con il codice del tuo ente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LinkCompanyPage,
});

const REASONS: Record<string, string> = {
  not_found: "Codice non trovato. Controlla di averlo scritto correttamente.",
  not_approved: "Questo ente è ancora in attesa di approvazione.",
  no_subscription: "L'abbonamento di questo ente non è attivo.",
  already_linked: "Il tuo account è già collegato a un ente.",
};

function LinkCompanyPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length < 3) return toast.error("Inserisci un codice valido");
    setLoading(true);
    try {
      const res = await joinCompanyByCode({ data: { code: clean } });
      if (!res.ok) {
        toast.error(REASONS[res.reason] ?? "Codice non valido");
        return;
      }
      toast.success(`Collegato a ${res.name}!`);
      navigate({ to: "/app" });
    } catch {
      toast.error("Errore di collegamento, riprova");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/40 to-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-8">
        <div className="mb-8 flex justify-center">
          <CiclaLogo size="md" />
        </div>

        <Card className="border-border/60 p-6 shadow-cicla">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Building2 size={20} />
            </span>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Collega il tuo ente</h1>
              <p className="text-xs text-muted-foreground">Ultimo passaggio per iniziare</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Codice azienda o Comune</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="es. ACME-7F2K"
                maxLength={20}
                minLength={3}
                required
                className="uppercase tracking-wider"
              />
              <p className="text-[11px] text-muted-foreground">
                Chiedi il codice al tuo datore di lavoro o al tuo Comune: serve per
                associare i tuoi spostamenti e ricevere i premi.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Collega account"}
            </Button>
          </form>
        </Card>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-6 inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <LogOut size={13} /> Esci
        </button>
      </div>
    </div>
  );
}
