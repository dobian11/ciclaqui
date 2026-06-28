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
import { Loader2, Building2 } from "lucide-react";
import { z } from "zod";
import { getPostLoginRedirect } from "@/lib/auth-redirect";

type AuthSearch = { mode?: "login" | "signup"; code?: string };

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    mode: s.mode === "signup" || s.mode === "login" ? s.mode : undefined,
    code: typeof s.code === "string" ? s.code : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Accedi · Cicla Qui" },
      { name: "description", content: "Accedi a Cicla Qui o crea il tuo account per iniziare a guadagnare punti con la mobilità sostenibile." },
    ],
  }),
  component: AuthPage,
});

const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Inserisci il tuo nome").max(80),
  email: z.string().trim().email("Email non valida").max(255),
  password: z.string().min(8, "Almeno 8 caratteri").max(72),
  company_code: z.string().trim().min(3, "Il codice azienda è obbligatorio").max(20),
  terms: z.literal(true, { message: "Devi accettare i termini per continuare" }),
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const search = useSearch({ from: "/auth" });
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const dest = await getPostLoginRedirect();
        navigate({ to: dest as never });
      }
    });
  }, [navigate]);

  async function redirectAfterAuth() {
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
    await redirectAfterAuth();
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      full_name: fd.get("full_name"),
      email: fd.get("email"),
      password: fd.get("password"),
      company_code: fd.get("company_code"),
      terms: acceptTerms,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dati non validi");
      return;
    }
    const { full_name, email, password, company_code } = parsed.data;
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: {
          full_name,
          signup_kind: "user",
          company_code: company_code.toUpperCase(),
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account creato!");
    await redirectAfterAuth();
  }

  const defaultTab = search.mode ?? "login";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/40 to-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
        <div className="mb-8 flex items-center justify-between">
          <CiclaLogo size="md" />
          <Link
            to="/azienda/auth"
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Building2 size={14} /> Sei un'azienda?
          </Link>
        </div>

        <Card className="border-border/60 p-6 shadow-cicla">
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Accedi</TabsTrigger>
              <TabsTrigger value="signup">Registrati</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input id="login-password" name="password" type="password" required autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Entra"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="su-name">Nome e cognome</Label>
                  <Input id="su-name" name="full_name" required maxLength={80} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-password">Password</Label>
                  <Input id="su-password" name="password" type="password" required minLength={8} autoComplete="new-password" />
                  <p className="text-[11px] text-muted-foreground">Almeno 8 caratteri.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-code">Codice azienda</Label>
                  <Input
                    id="su-code"
                    name="company_code"
                    placeholder="es. ACME-7F2K"
                    maxLength={20}
                    minLength={3}
                    required
                    defaultValue={search.code ?? ""}
                    className="uppercase tracking-wider"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Obbligatorio. Chiedi il codice al tuo datore di lavoro per essere associato alla tua azienda.
                  </p>
                </div>
                <label className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/30 p-3">
                  <Checkbox
                    id="terms"
                    checked={acceptTerms}
                    onCheckedChange={(v) => setAcceptTerms(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-[12px] leading-snug text-muted-foreground">
                    Accetto i <a href="#" className="font-semibold text-foreground underline-offset-2 hover:underline">Termini di servizio</a> e la{" "}
                    <a href="#" className="font-semibold text-foreground underline-offset-2 hover:underline">Privacy policy</a> di Cicla Qui.
                  </span>
                </label>
                <Button type="submit" className="w-full" disabled={loading || !acceptTerms}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Crea il mio account"}
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
