import { createFileRoute, Link, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { emailLinkOrigin } from "@/lib/public-url";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { CiclaLogo } from "@/components/cicla/CiclaLogo";
import { ForgotPasswordDialog } from "@/components/cicla/ForgotPasswordDialog";
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
import { checkCompanyCode } from "@/lib/company-code.functions";

type AuthSearch = { mode?: "login" | "signup"; code?: string };

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    mode: s.mode === "signup" || s.mode === "login" ? s.mode : undefined,
    code: typeof s.code === "string" ? s.code : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Accedi o registrati · Cicla Qui" },
      { name: "description", content: "Accedi a Cicla Qui o crea il tuo account per iniziare a guadagnare punti con la mobilità sostenibile." },
      { property: "og:title", content: "Accedi o registrati · Cicla Qui" },
      {
        property: "og:description",
        content: "Entra in Cicla Qui con il codice del tuo ente e inizia a trasformare i chilometri in punti.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://ciclaqui.it/auth" },
    ],
    links: [{ rel: "canonical", href: "https://ciclaqui.it/auth" }],
  }),
  component: AuthPage,
});

const signupSchema = z
  .object({
    full_name: z.string().trim().min(2, "Inserisci nome e cognome").max(80),
    phone: z
      .string()
      .trim()
      .min(6, "Inserisci un numero di telefono valido")
      .max(20)
      .regex(/^[+0-9 ().-]+$/, "Numero di telefono non valido"),
    email: z.string().trim().email("Email non valida").max(255),
    password: z.string().min(8, "Almeno 8 caratteri").max(72),
    password2: z.string(),
    company_code: z.string().trim().min(3, "Il codice ente è obbligatorio").max(20),
    terms: z.literal(true, { message: "Devi accettare i termini per continuare" }),
  })
  .refine((v) => v.password === v.password2, {
    message: "Le due password non coincidono",
    path: ["password2"],
  });

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const search = useSearch({ from: "/auth" });
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const checkCode = useServerFn(checkCompanyCode);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleResend() {
    if (!pendingEmail || cooldown > 0) return;
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: `${emailLinkOrigin()}/app` },
    });
    setLoading(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("not found") || msg.includes("already") || msg.includes("confirmed")) {
        toast.error("Questo indirizzo non risulta in attesa di conferma", {
          description:
            "Se l'account è già confermato prova ad accedere; altrimenti registrati di nuovo con questa email.",
          duration: 9000,
        });
        setPendingEmail(null);
        return;
      }
      return toast.error(error.message);
    }
    setCooldown(60);
    toast.success("Email di conferma inviata di nuovo", {
      description: "Controlla anche la cartella Spam/Promozioni: il mittente è notify.ciclaqui.it.",
    });
  }


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
      phone: fd.get("phone"),
      email: fd.get("email"),
      password: fd.get("password"),
      password2: fd.get("password2"),
      company_code: fd.get("company_code"),
      terms: acceptTerms,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dati non validi");
      return;
    }
    const { full_name, phone, email, password, company_code } = parsed.data;
    const code = company_code.toUpperCase();
    setLoading(true);

    // 1. Il codice ente viene verificato PRIMA di creare l'account:
    //    se non è valido non si procede (niente secondo passaggio dopo l'email).
    try {
      const check = await checkCode({ data: { code } });
      if (!check.ok) {
        setLoading(false);
        return toast.error(
          check.reason === "not_approved"
            ? `${check.name ?? "Questo ente"} è ancora in attesa di approvazione: riprova più tardi.`
            : "Codice ente non valido. Chiedilo alla tua azienda o al tuo Comune.",
        );
      }
      setCompanyName(check.name ?? null);
    } catch {
      setLoading(false);
      return toast.error("Impossibile verificare il codice ente, riprova");
    }

    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${emailLinkOrigin()}/app`,
        data: {
          full_name,
          phone,
          signup_kind: "user",
          company_code: code,
        },
      },
    });
    setLoading(false);
    if (isEmailAlreadyRegistered(signUpData, error)) {
      return toast.error(EMAIL_EXISTS_TITLE, { description: EMAIL_EXISTS_DESCRIPTION, duration: 8000 });
    }
    if (error) return toast.error(error.message);
    if (!signUpData.session) {
      setPendingEmail(email);
      setCooldown(60);
      toast.success("Ti abbiamo inviato una email di conferma");
      return;
    }
    toast.success("Account creato!");
    await redirectAfterAuth();
  }

  const defaultTab = search.mode ?? "login";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/40 to-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
        <h1 className="sr-only">Accedi o registrati a Cicla Qui</h1>
        <div className="mb-8 flex items-center justify-between">
          <CiclaLogo size="md" />
          <Link
            to="/azienda/auth"
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Building2 size={14} /> Azienda o Comune?
          </Link>
        </div>

        <Card className="border-border/60 p-6 shadow-cicla">
          {pendingEmail ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-cicla/30 bg-cicla/10 p-4">
                <p className="text-sm font-semibold">Conferma la tua email</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Abbiamo inviato un link di conferma a <strong>{pendingEmail}</strong>.
                  Aprilo per attivare l'account: verrai portato direttamente nell'app
                  {companyName ? ` come membro di ${companyName}` : ""}.
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Non la trovi? Controlla <strong>Spam</strong> e <strong>Promozioni</strong>: il
                  mittente è <strong>notify.ciclaqui.it</strong>.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={loading || cooldown > 0}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : cooldown > 0 ? (
                  `Rinvia email tra ${cooldown}s`
                ) : (
                  "Rinvia email di conferma"
                )}
              </Button>

              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setPendingEmail(null)}
              >
                ← Torna all'accesso
              </button>
            </div>
          ) : (


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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Password</Label>
                    <ForgotPasswordDialog />
                  </div>
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
                  <Label htmlFor="su-phone">Numero di telefono</Label>
                  <Input id="su-phone" name="phone" type="tel" required maxLength={20} autoComplete="tel" placeholder="+39 333 1234567" />
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
                  <Label htmlFor="su-password2">Ripeti password</Label>
                  <Input id="su-password2" name="password2" type="password" required minLength={8} autoComplete="new-password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-code">Codice azienda o Comune</Label>
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
                    Obbligatorio e verificato subito: chiedilo al tuo datore di lavoro o al tuo
                    Comune. Dopo la conferma dell'email entri direttamente nell'app.
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
          )}

        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Torna al benvenuto</Link>
        </p>
      </div>
    </div>
  );
}
