import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, ShieldAlert, MapPin, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { lookupStolenBike, addSighting } from "@/lib/bikes.functions";

const searchSchema = z.object({
  telaio: z.string().optional(),
});

export const Route = createFileRoute("/cerca-bici")({
  validateSearch: searchSchema,
  component: CercaBiciPage,
  head: () => ({
    meta: [
      { title: "Cerca una bici rubata · Cicla Qui" },
      {
        name: "description",
        content:
          "Registro pubblico delle bici segnalate rubate. Cerca per numero di telaio e segnala un avvistamento.",
      },
      { property: "og:title", content: "Cerca una bici rubata · Cicla Qui" },
      {
        property: "og:description",
        content: "Controlla il numero di telaio nel registro pubblico delle bici rubate e segnala un avvistamento.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://ciclaqui.it/cerca-bici" },
    ],
    links: [{ rel: "canonical", href: "https://ciclaqui.it/cerca-bici" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Registro bici rubate Cicla Qui",
          url: "https://ciclaqui.it/cerca-bici",
          applicationCategory: "SecurityApplication",
          operatingSystem: "Web",
          description:
            "Registro pubblico delle biciclette segnalate rubate: ricerca per numero di telaio e segnalazione avvistamenti.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        }),
      },
    ],
  }),
});

type StolenBike = Awaited<ReturnType<typeof lookupStolenBike>>;

function CercaBiciPage() {
  const { telaio } = useSearch({ from: "/cerca-bici" });
  const [query, setQuery] = useState(telaio ?? "");
  const [result, setResult] = useState<StolenBike | "not-found" | null>(
    null,
  );
  const lookupFn = useServerFn(lookupStolenBike);

  const search = useMutation({
    mutationFn: () => lookupFn({ data: { query } }),
    onSuccess: (data) => setResult(data ?? "not-found"),
    onError: (e: Error) => toast.error(e.message),
  });

  // Auto-search if arriving with ?telaio=
  useEffect(() => {
    if (telaio && telaio.length >= 3) search.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-md px-5 py-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <ArrowLeft size={14} /> Home
        </Link>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
          Registro bici rubate
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Stai per acquistare una bici usata? Cerca il numero di telaio per
          verificare che non sia stata rubata.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim().length >= 3) search.mutate();
          }}
          className="mt-6 flex gap-2"
        >
          <input
            id="frame-number"
            aria-label="Numero di telaio della bici"
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            placeholder="Numero telaio"
            className="input-base flex-1 font-mono"
            minLength={3}
            required
          />
          <button
            type="submit"
            disabled={search.isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-cicla px-4 py-2.5 text-sm font-semibold text-cicla-foreground disabled:opacity-50"
          >
            <Search size={16} /> Cerca
          </button>
        </form>

        <div className="mt-6">
          {result === "not-found" && (
            <div className="rounded-2xl border border-cicla/30 bg-cicla/10 p-5 text-center">
              <p className="font-semibold text-cicla">Nessuna segnalazione</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Il telaio <span className="font-mono">{query}</span> non
                risulta nel registro delle bici rubate.
              </p>
            </div>
          )}
          {result && result !== "not-found" && (
            <StolenBikePanel bike={result} />
          )}
        </div>
      </div>
    </div>
  );
}

function StolenBikePanel({ bike }: { bike: NonNullable<StolenBike> }) {
  const sightFn = useServerFn(addSighting);
  const [note, setNote] = useState("");
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});

  const mut = useMutation({
    mutationFn: () =>
      sightFn({
        data: { bike_id: bike.id, note, lat: coords.lat, lng: coords.lng },
      }),
    onSuccess: () => {
      toast.success("Grazie! Avvistamento inviato al proprietario.");
      setNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5">
        <div className="flex items-center gap-2 text-destructive">
          <ShieldAlert size={18} />
          <span className="text-xs font-bold uppercase tracking-wide">
            Bici segnalata come rubata
          </span>
        </div>
        <h2 className="mt-3 font-display text-xl font-bold">
          {bike.marca} {bike.modello ?? ""}
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Telaio</dt>
            <dd className="font-mono">{bike.frame_number}</dd>
          </div>
          {bike.colore && (
            <div>
              <dt className="text-xs text-muted-foreground">Colore</dt>
              <dd>{bike.colore}</dd>
            </div>
          )}
          {bike.stolen_at && (
            <div>
              <dt className="text-xs text-muted-foreground">Rubata il</dt>
              <dd>{new Date(bike.stolen_at).toLocaleString("it-IT")}</dd>
            </div>
          )}
          {bike.stolen_place && (
            <div>
              <dt className="text-xs text-muted-foreground">Luogo del furto</dt>
              <dd>{bike.stolen_place}</dd>
            </div>
          )}
          {bike.stolen_note && (
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Note proprietario</dt>
              <dd>{bike.stolen_note}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <h3 className="font-display font-semibold">Hai visto questa bici?</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Invia un avvistamento anonimo. Verrà notificato al proprietario.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Dove l'hai vista, in che condizioni, eventuali dettagli…"
          rows={3}
          maxLength={500}
          className="input-base mt-3 w-full resize-none"
        />
        <button
          type="button"
          onClick={() => {
            navigator.geolocation?.getCurrentPosition(
              (pos) =>
                setCoords({
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                }),
              () => toast.error("Posizione non disponibile"),
              { timeout: 5000 },
            );
          }}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-cicla"
        >
          <MapPin size={14} />{" "}
          {coords.lat ? "Posizione allegata ✓" : "Allega la mia posizione"}
        </button>
        <button
          type="button"
          disabled={mut.isPending || note.trim().length < 3}
          onClick={() => mut.mutate()}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-cicla py-2.5 text-sm font-semibold text-cicla-foreground disabled:opacity-50"
        >
          <Send size={14} /> Invia avvistamento
        </button>
      </div>
    </div>
  );
}
