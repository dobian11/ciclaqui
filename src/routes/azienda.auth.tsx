import { createFileRoute, Link, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CiclaLogo } from "@/components/cicla/CiclaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, User } from "lucide-react";
import { getPostLoginRedirect } from "@/lib/auth-redirect";
import { requestManagerRole } from "@/lib/companies.functions";
import { GoogleSignInButton, AuthDivider } from "@/components/cicla/GoogleSignInButton";

type Search = { mode?: "login" | "signup"; manager?: boolean };

export const Route = createFileRoute("/azienda/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    mode: s.mode === "signup" || s.mode === "login" ? s.mode : undefined,
    manager: s.manager === true || s.manager === "1" || s.manager === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Area Aziende · Cicla Qui" },
      { name: "description", content: "Registra la tua azienda su Cicla Qui: genera il codice per i dipendenti e premia la mobilità sostenibile." },
    ],
  }),
  component: CompanyAuthPage,
});

function CompanyAuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const search = useSearch({ from: "/azienda/auth" });
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      // Ritorno dal login Google dall'area enti: attiva il ruolo referente.
      if (search.manager) {
        try {
          await requestManagerRole();
        } catch {
          toast.error("Impossibile attivare l'area enti per questo account");
        }
      }
      const dest = await getPostLoginRedirect();
      navigate({ to: dest as never });
    });
  }, [navigate, search.manager]);

  async function redirectAfter() {
    await router.invalidate();
    const dest = await getPostLoginRedirect();
    navigate({ to: dest as never });
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email") || "").trim(),
      password: String(fd.get("password") || ""),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bentornato!");
    await redirectAfter();
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!acceptTerms) return toast.error("Devi accettare i termini per continuare");
    const fd = new FormData(e.currentTarget);
    const manager_name = String(fd.get("manager_name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");

    if (manager_name.length < 2) return toast.error("Inserisci il nome del referente");
    if (!email) return toast.error("Inserisci l'email");
    if (password.length < 8) return toast.error("Password almeno 8 caratteri");

    setLoading(true);
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/azienda/onboarding`,
        data: { full_name: manager_name, signup_kind: "company_manager" },
      },
    });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    setLoading(false);
    if (!signUpData.session) {
      setPendingEmail(email);
      toast.success("Ti abbiamo inviato una email di conferma");
      return;
    }
    toast.success("Account creato! Completa l'onboarding della tua azienda.");
    await redirectAfter();
  }

  const defaultTab = search.mode ?? "login";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/40 to-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
        <div className="mb-8 flex items-center justify-between">
          <CiclaLogo size="md" />
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <User size={14} /> Sei un utente?
          </Link>
        </div>

        <div className="mb-4">
          <span className="rounded-full bg-cicla/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cicla">
            Aziende & Comuni
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">Cicla Qui per il tuo ente</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea l'account del referente: nel passo successivo registrerai
            l'<strong>azienda</strong> o il <strong>Comune</strong> (dati, codice da distribuire,
            premi/voucher) e attiverai l'abbonamento mensile.
          </p>
        </div>

        <Card className="border-border/60 p-6 shadow-cicla">
          {pendingEmail && (
            <div className="mb-5 rounded-xl border border-cicla/30 bg-cicla/10 p-4">
              <p className="text-sm font-semibold">Conferma la tua email</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Abbiamo inviato un link di conferma a <strong>{pendingEmail}</strong>.
                Aprilo per attivare l'account e completare la registrazione dell'ente.
              </p>
            </div>
          )}

          <GoogleSignInButton redirectPath="/azienda/auth?manager=1" />
          <AuthDivider />

          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Accedi</TabsTrigger>
              <TabsTrigger value="signup">Inizia ora</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="caz-email">Email referente</Label>
                  <Input id="caz-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="caz-pwd">Password</Label>
                  <Input id="caz-pwd" name="password" type="password" required autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Entra"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="su-mname">Nome referente</Label>
                  <Input id="su-mname" name="manager_name" required maxLength={80} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-cemail">Email referente</Label>
                  <Input id="su-cemail" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-cpwd">Password</Label>
                  <Input id="su-cpwd" name="password" type="password" required minLength={8} />
                </div>
                <label className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/30 p-3">
                  <Checkbox
                    checked={acceptTerms}
                    onCheckedChange={(v) => setAcceptTerms(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-[12px] leading-snug text-muted-foreground">
                    Accetto i <a href="#" className="font-semibold text-foreground underline-offset-2 hover:underline">Termini per le aziende</a>,
                    inclusi i costi di abbonamento mensile.
                  </span>
                </label>
                <Button type="submit" className="w-full" disabled={loading || !acceptTerms}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Continua all'onboarding"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Torna al benvenuto</Link>
        </p>
      </div>
    </div>
  );
}
