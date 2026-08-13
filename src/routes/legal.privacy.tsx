import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Cicla Qui" },
      { name: "description", content: "Informativa sul trattamento dei dati personali ai sensi del Regolamento UE 2016/679 (GDPR)." },
      { property: "og:title", content: "Privacy Policy — Cicla Qui" },
      {
        property: "og:description",
        content: "Come Cicla Qui tratta i dati personali di utenti, aziende e comuni secondo il GDPR.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://ciclaqui.it/legal/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://ciclaqui.it/legal/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link to="/" className="text-xs uppercase tracking-wider text-muted-foreground">← Home</Link>
        <h1 className="mt-4 font-display text-3xl font-bold">Informativa Privacy</h1>
        <p className="mt-1 text-xs text-muted-foreground">Ultimo aggiornamento: 28 giugno 2026 — v1.0</p>

        <Section title="1. Titolare del trattamento">
          <p>Cicla Qui S.r.l. (in costituzione) — info@ciclaqui.it. In attesa di formalizzazione, il titolare del trattamento è il legale rappresentante pro-tempore.</p>
        </Section>

        <Section title="2. Dati trattati">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Account</strong>: email, nome, codice ente di iscrizione, ruolo.</li>
            <li><strong>Mobilità</strong>: posizione GPS durante i viaggi attivi, modalità di trasporto rilevata (bici/piedi/auto), distanza, durata.</li>
            <li><strong>Sensori</strong>: accelerometro e bussola (solo durante un viaggio attivo, per anti-frode) — non vengono memorizzate le letture grezze, solo lo score di classificazione.</li>
            <li><strong>Bici</strong>: marca, modello, colore, numero di telaio, foto facoltative.</li>
            <li><strong>Tecnici</strong>: IP, user-agent, log applicativi.</li>
          </ul>
        </Section>

        <Section title="3. Finalità e base giuridica">
          <ul className="list-disc pl-5 space-y-1">
            <li>Erogazione del servizio (art. 6.1.b GDPR — contratto).</li>
            <li>Accredito punti e gestione premi/prelievi (art. 6.1.b).</li>
            <li>Sicurezza, anti-frode, prevenzione abusi (art. 6.1.f — legittimo interesse).</li>
            <li>Adempimenti fiscali e contabili per i prelievi (art. 6.1.c).</li>
            <li>Comunicazioni di marketing e profilazione (art. 6.1.a — consenso, sempre revocabile).</li>
          </ul>
        </Section>

        <Section title="4. Conservazione">
          <p>I dati di account sono conservati per la durata del rapporto e per 10 anni successivi alla cessazione per obblighi contabili. I tracciati GPS in forma identificabile sono conservati 24 mesi e poi anonimizzati per finalità statistiche.</p>
        </Section>

        <Section title="5. Diritti dell'interessato (artt. 15-22 GDPR)">
          <p>Hai diritto di accesso, rettifica, cancellazione, limitazione, portabilità e opposizione. Puoi esercitarli direttamente dall'app in <em>Profilo → Privacy</em> oppure scrivendo a privacy@ciclaqui.it. In caso di reclamo: Garante per la Protezione dei Dati Personali (www.garanteprivacy.it).</p>
        </Section>

        <Section title="6. Trasferimenti extra-UE">
          <p>I dati sono ospitati in UE. Alcuni servizi tecnici (mappe, push notifications) potrebbero comportare trasferimenti regolati da Clausole Contrattuali Standard.</p>
        </Section>

        <Section title="7. Sicurezza">
          <p>Crittografia in transito (TLS 1.3), separazione dei ruoli, Row-Level Security sul database, hashing degli IP nei log di consenso.</p>
        </Section>

        <Section title="8. Minori">
          <p>Il servizio è riservato a maggiorenni o a minori autorizzati dall'ente di iscrizione (scuola, comune) con consenso del genitore.</p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card/50 p-5">
      <h2 className="font-display text-lg font-semibold text-cicla">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
