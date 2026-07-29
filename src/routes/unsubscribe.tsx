import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CiclaLogo } from "@/components/cicla/CiclaLogo";
import { Loader2, Check, AlertTriangle, MailX } from "lucide-react";

export const Route = createFileRoute("/unsubscribe")({
  ssr: false,
  component: UnsubscribePage,
  head: () => ({
    meta: [
      { title: "Disiscrizione email — Cicla Qui" },
      {
        name: "description",
        content:
          "Gestisci le tue preferenze email di Cicla Qui e disiscriviti dalle comunicazioni dell'app.",
      },
      { property: "og:title", content: "Disiscrizione email — Cicla Qui" },
      {
        property: "og:description",
        content: "Gestisci le preferenze email di Cicla Qui e disiscriviti in un clic.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type State = "loading" | "confirm" | "done" | "already" | "invalid" | "error";

function UnsubscribePage() {
  const [state, setState] = useState<State>("loading");
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
    if (!t) {
      setState("invalid");
      return;
    }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) return setState("invalid");
        if (body.valid) return setState("confirm");
        if (body.reason === "already_unsubscribed") return setState("already");
        setState("invalid");
      })
      .catch(() => setState("error"));
  }, []);

  async function confirm() {
    if (!token) return;
    setSubmitting(true);
    try {
      const r = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await r.json().catch(() => ({}));
      if (body.success) setState("done");
      else if (body.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-b from-background via-secondary/40 to-background px-5">
      <Card className="w-full max-w-md p-6 text-center">
        <div className="flex justify-center">
          <CiclaLogo size="md" />
        </div>

        {state === "loading" && (
          <div className="mt-8 flex justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {state === "confirm" && (
          <>
            <MailX className="mx-auto mt-6 size-8 text-muted-foreground" />
            <h1 className="mt-3 text-xl font-bold">Confermi la disiscrizione?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Non riceverai più le email informative di Cicla Qui a questo indirizzo.
              Le comunicazioni obbligatorie legate al tuo account potrebbero comunque essere inviate.
            </p>
            <Button className="mt-5 w-full" onClick={confirm} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Disiscrivimi
            </Button>
          </>
        )}

        {state === "done" && (
          <>
            <Check className="mx-auto mt-6 size-8 text-cicla" />
            <h1 className="mt-3 text-xl font-bold">Disiscrizione completata</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Non ti invieremo più email a questo indirizzo.
            </p>
          </>
        )}

        {state === "already" && (
          <>
            <Check className="mx-auto mt-6 size-8 text-muted-foreground" />
            <h1 className="mt-3 text-xl font-bold">Sei già disiscritto</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Questo indirizzo è già stato rimosso dalle nostre comunicazioni.
            </p>
          </>
        )}

        {(state === "invalid" || state === "error") && (
          <>
            <AlertTriangle className="mx-auto mt-6 size-8 text-destructive" />
            <h1 className="mt-3 text-xl font-bold">Link non valido</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Il link di disiscrizione è scaduto o non è corretto. Riprova dall'ultima email ricevuta.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
