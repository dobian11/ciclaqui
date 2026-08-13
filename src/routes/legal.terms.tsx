import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Termini di Servizio — Cicla Qui" },
      { name: "description", content: "Condizioni d'uso della piattaforma Cicla Qui per utenti, aziende e comuni." },
      { property: "og:title", content: "Termini di Servizio — Cicla Qui" },
      {
        property: "og:description",
        content: "Regole d'uso di Cicla Qui: iscrizione con codice ente, natura dei punti, premi e prelievi.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://ciclaqui.it/legal/terms" },
    ],
    links: [{ rel: "canonical", href: "https://ciclaqui.it/legal/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link to="/" className="text-xs uppercase tracking-wider text-muted-foreground">← Home</Link>
        <h1 className="mt-4 font-display text-3xl font-bold">Termini di Servizio</h1>
        <p className="mt-1 text-xs text-muted-foreground">Ultimo aggiornamento: 28 giugno 2026 — v1.0</p>

        <S title="1. Oggetto">Cicla Qui è una piattaforma per la promozione della mobilità sostenibile attraverso il riconoscimento di punti premiali da parte di Aziende e Comuni iscritti.</S>
        <S title="2. Iscrizione">L'iscrizione utente richiede un codice fornito da un ente autorizzato (Azienda o Comune). Gli enti devono completare la procedura di approvazione amministrativa e sottoscrivere un abbonamento attivo per generare codici.</S>
        <S title="3. Natura dei punti">I punti accumulati <strong>non costituiscono moneta corrente</strong>. Sono unità di riconoscimento il cui valore (voucher, donazione, importo in euro) è stabilito dall'ente di appartenenza dell'utente.</S>
        <S title="4. Prelievi e premi">Ogni ente definisce il proprio catalogo premi e le regole di conversione. I prelievi in denaro, se previsti, sono erogati tramite Stripe Connect e soggetti agli obblighi fiscali del beneficiario.</S>
        <S title="5. Anti-frode">Cicla Qui applica controlli automatici (GPS, accelerometro, bussola) per distinguere i mezzi di trasporto. I viaggi con score di confidenza basso vengono sospesi e sottoposti a revisione dell'ente. Tentativi di frode comportano sospensione e segnalazione all'ente.</S>
        <S title="6. SOS">La funzione SOS reindirizza all'applicazione esterna <em>db360app.it</em> e non costituisce un servizio di emergenza certificato. In caso di reale emergenza chiamare il <strong>112</strong>.</S>
        <S title="7. Responsabilità">L'utente è unico responsabile della propria condotta su strada e del rispetto del Codice della Strada. Cicla Qui non risponde di incidenti, furti o danni occorsi durante l'uso.</S>
        <S title="8. Modifiche">Cicla Qui può aggiornare i presenti termini comunicando agli utenti tramite l'app con 30 giorni di preavviso per modifiche sostanziali.</S>
        <S title="9. Foro competente">Per qualsiasi controversia è competente in via esclusiva il Foro di residenza del consumatore.</S>
      </div>
    </div>
  );
}
function S({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card/50 p-5">
      <h2 className="font-display text-lg font-semibold text-cicla">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
