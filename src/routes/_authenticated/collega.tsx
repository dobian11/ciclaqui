import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { joinCompanyByCode, requestManagerRole } from "@/lib/companies.functions";
import { CiclaLogo } from "@/components/cicla/CiclaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Building2, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/collega")({
  head: () => ({
    meta: [
      { title: "Completa il tuo account · Cicla Qui" },
      {
        name: "description",
        content:
          "Completa i dati del profilo e inserisci il codice della tua azienda o del tuo Comune per attivare punti e premi su Cicla Qui.",
      },
      { property: "og:title", content: "Completa il tuo account · Cicla Qui" },
      {
        property: "og:description",
        content: "Attiva il tuo account Cicla Qui con i tuoi dati e il codice del tuo ente.",
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
  already_member: "Sei già collegato a un ente come dipendente/cittadino.",
};

function LinkCompanyPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [weight, setWeight] = useState("");
  const [accepted, setAccepted] = useState(false);

  // Con Google alcuni dati mancano: precompiliamo quello che l'IdP fornisce
  // e lasciamo che l'utente completi il resto prima di poter proseguire.
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user || !active) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, weight_kg")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      const meta = user.user_metadata as { full_name?: string; name?: string } | null;
      setFullName(profile?.full_name || meta?.full_name || meta?.name || "");
      if (profile?.weight_kg) setWeight(String(profile.weight_kg));
    })();
    return () => {
      active = false;
    };
  }, []);

  async function saveProfileData(userId: string) {
    const weightNum = weight.trim() ? Number(weight) : null;
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        weight_kg: weightNum && weightNum > 0 ? weightNum : null,
      })
      .eq("id", userId);
    if (error) throw error;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (fullName.trim().length < 2) return toast.error("Inserisci nome e cognome");
    if (clean.length < 3) return toast.error("Inserisci un codice valido");
    if (!accepted) return toast.error("Devi accettare privacy e termini");
    if (weight.trim() && (Number(weight) < 30 || Number(weight) > 250)) {
      return toast.error("Inserisci un peso realistico (30-250 kg)");
    }
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("no-session");
      await saveProfileData(userData.user.id);

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

  // Chi entra con Google ma è un'azienda o un Comune deve poter passare
  // all'onboarding ente invece di restare bloccato sul codice.
  async function handleBecomeManager() {
    if (fullName.trim().length < 2) return toast.error("Inserisci prima nome e cognome");
    setSwitching(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("no-session");
      await saveProfileData(userData.user.id);
      const res = await requestManagerRole();
      if (!res.ok) {
        toast.error(REASONS[res.reason] ?? "Operazione non disponibile");
        return;
      }
      navigate({ to: "/azienda/onboarding" });
    } catch {
      toast.error("Errore, riprova");
    } finally {
      setSwitching(false);
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
              <h1 className="text-lg font-semibold leading-tight">Completa il tuo account</h1>
              <p className="text-xs text-muted-foreground">Ultimo passaggio per iniziare</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome e cognome</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Mario Rossi"
                maxLength={80}
                minLength={2}
                required
                autoComplete="name"
              />
            </div>

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

            <div className="space-y-2">
              <Label htmlFor="weight">
                Peso (kg) <span className="text-muted-foreground">· opzionale</span>
              </Label>
              <Input
                id="weight"
                type="number"
                inputMode="numeric"
                min={30}
                max={250}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="70"
              />
              <p className="text-[11px] text-muted-foreground">
                Serve solo per stimare calorie e CO₂ risparmiata.
              </p>
            </div>

            <label className="flex items-start gap-2.5 text-[12px] leading-snug text-muted-foreground">
              <Checkbox
                checked={accepted}
                onCheckedChange={(v) => setAccepted(v === true)}
                className="mt-0.5"
              />
              <span>
                Accetto la{" "}
                <a href="/legal/privacy" className="text-primary underline">
                  Privacy Policy
                </a>{" "}
                e i{" "}
                <a href="/legal/terms" className="text-primary underline">
                  Termini di servizio
                </a>
                .
              </span>
            </label>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Completa e collega"}
            </Button>
          </form>

          <div className="mt-5 border-t border-border/60 pt-4 text-center">
            <p className="text-[11px] text-muted-foreground">
              Rappresenti un'azienda o un Comune?
            </p>
            <button
              type="button"
              onClick={handleBecomeManager}
              disabled={switching}
              className="mt-1 text-xs font-medium text-primary hover:underline disabled:opacity-60"
            >
              {switching ? "Attendere…" : "Registra il tuo ente"}
            </button>
          </div>
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
