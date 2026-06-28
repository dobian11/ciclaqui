import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/cookie")({
  head: () => ({ meta: [{ title: "Cookie Policy — Cicla Qui" }] }),
  component: CookiePage,
});

function CookiePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link to="/" className="text-xs uppercase tracking-wider text-muted-foreground">← Home</Link>
        <h1 className="mt-4 font-display text-3xl font-bold">Cookie Policy</h1>
        <div className="mt-6 space-y-4 text-sm text-muted-foreground">
          <p>Cicla Qui utilizza cookie e tecnologie equivalenti per garantire il funzionamento del servizio e, previo consenso, per analisi e marketing.</p>
          <Block title="Cookie tecnici (necessari)">Sempre attivi. Servono per autenticazione, sessione e sicurezza. Non richiedono consenso.</Block>
          <Block title="Cookie analitici">Attivi solo previo consenso. Misurano l'uso aggregato dell'app per migliorarla.</Block>
          <Block title="Cookie di marketing">Attivi solo previo consenso. Personalizzano comunicazioni e annunci.</Block>
          <p>Puoi modificare le tue preferenze in qualsiasi momento dal banner inferiore o dalla pagina <em>Profilo → Privacy</em>.</p>
        </div>
      </div>
    </div>
  );
}
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4">
      <h3 className="font-display font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}
