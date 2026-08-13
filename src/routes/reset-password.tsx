import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CiclaLogo } from "@/components/cicla/CiclaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reimposta la password · Cicla Qui" },
      {
        name: "description",
        content:
          "Imposta una nuova password per il tuo account Cicla Qui e torna subito ad accedere all'app o al pannello ente.",
      },
      { property: "og:title", content: "Reimposta la password · Cicla Qui" },
      {
        property: "og:description",
        content: "Scegli una nuova password per il tuo account Cicla Qui.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://ciclaqui.it/reset-password" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://ciclaqui.it/reset-password" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") || "");
    const password2 = String(fd.get("password2") || "");
    if (password.length < 8) return toast.error("Password almeno 8 caratteri");
    if (password !== password2) return toast.error("Le due password non coincidono");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    setDone(true);
    toast.success("Password aggiornata");
    setTimeout(() => navigate({ to: "/auth" }), 1500);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/40 to-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
        <div className="mb-8">
          <CiclaLogo size="md" />
        </div>
        <h1 className="mb-1 text-2xl font-bold tracking-tight">Nuova password</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          Scegli una password di almeno 8 caratteri per tornare ad accedere.
        </p>

        <Card className="border-border/60 p-6 shadow-cicla">
          {done ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Password aggiornata</p>
              <p className="text-xs text-muted-foreground">
                Ora puoi accedere con le nuove credenziali.
              </p>
              <Button asChild className="w-full">
                <Link to="/auth">Vai all'accesso</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rp-pwd">Nuova password</Label>
                <Input id="rp-pwd" name="password" type="password" required minLength={8} autoComplete="new-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp-pwd2">Ripeti password</Label>
                <Input id="rp-pwd2" name="password2" type="password" required minLength={8} autoComplete="new-password" />
              </div>
              {!ready && (
                <p className="text-[11px] text-muted-foreground">
                  Apri questa pagina dal link ricevuto via email: senza quel link il
                  salvataggio non andrà a buon fine.
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Salva password"}
              </Button>
            </form>
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/auth" className="hover:text-foreground">← Torna all'accesso</Link>
        </p>
      </div>
    </div>
  );
}
