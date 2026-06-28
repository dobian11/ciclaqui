import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CiclaLogo } from "@/components/cicla/CiclaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, User } from "lucide-react";
import { createCompany } from "@/lib/companies.functions";

export const Route = createFileRoute("/azienda/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Area Aziende · Cicla Qui" },
      { name: "description", content: "Gestisci i tuoi dipendenti e promuovi la mobilità sostenibile nella tua azienda con Cicla Qui." },
    ],
  }),
  component: CompanyAuthPage,
});

function CompanyAuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/app" });
    });
  }, [navigate]);

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
    await router.invalidate();
    navigate({ to: "/app" });
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const company_name = String(fd.get("company_name") || "").trim();
    const vat = String(fd.get("vat") || "").trim();
    const iban = String(fd.get("iban") || "").trim();
    const manager_name = String(fd.get("manager_name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");

    if (company_name.length < 2) return toast.error("Inserisci il nome dell'azienda");
    if (manager_name.length < 2) return toast.error("Inserisci il nome del referente");
    if (!email) return toast.error("Inserisci l'email");
    if (password.length < 8) return toast.error("Password almeno 8 caratteri");

    setLoading(true);
    const { error: signupErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: {
          full_name: manager_name,
          signup_kind: "company_manager",
        },
      },
    });
    if (signupErr) {
      setLoading(false);
      return toast.error(signupErr.message);
    }

    // Ensure session (handles email-confirm-disabled case)
    let { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      const { data: signin } = await supabase.auth.signInWithPassword({ email, password });
      userData = { user: signin.user } as typeof userData;
    }

    if (!userData.user) {
      setLoading(false);
      toast.success("Account creato! Conferma l'email per attivarlo, poi torna qui per registrare la tua azienda.");
      return;
    }

    try {
      const company = await createCompany({
        data: {
          name: company_name,
          vat: vat || undefined,
          iban: iban || undefined,
          contact_email: email,
        },
      });
      setLoading(false);
      toast.success(`Azienda registrata! Codice: ${company.code}`, { duration: 8000 });
      await router.invalidate();
      navigate({ to: "/app" });
    } catch (err) {
      setLoading(false);
      console.error(err);
      toast.error((err as Error)?.message ?? "Errore creazione azienda");
    }
  }

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
            Area aziende
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">Cicla Qui per la tua azienda</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Genera un codice univoco e premia i tuoi dipendenti per la mobilità sostenibile.
          </p>
        </div>

        <Card className="border-border/60 p-6 shadow-cicla">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Accedi</TabsTrigger>
              <TabsTrigger value="signup">Registra azienda</TabsTrigger>
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
                  <Label htmlFor="su-cname">Ragione sociale</Label>
                  <Input id="su-cname" name="company_name" required maxLength={120} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="su-vat">Partita IVA</Label>
                    <Input id="su-vat" name="vat" maxLength={32} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-iban">IBAN</Label>
                    <Input id="su-iban" name="iban" maxLength={34} className="uppercase" />
                  </div>
                </div>
                <div className="border-t pt-4 space-y-2">
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
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Registra azienda"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Dopo la registrazione riceverai un <strong>codice azienda</strong> univoco da
          condividere con i tuoi dipendenti.
        </p>
      </div>
    </div>
  );
}
