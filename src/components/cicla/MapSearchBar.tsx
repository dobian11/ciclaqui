import { useEffect, useRef, useState } from "react";
import { Search, X, Loader2, MapPin } from "lucide-react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import type { Poi } from "@/lib/pois";

interface Suggestion {
  id: string;
  primary: string;
  secondary: string;
  /** Callback che risolve il place in coordinate quando viene selezionato. */
  resolve: () => Promise<Poi | null>;
}

/**
 * Ricerca indirizzi/luoghi con Places API (New).
 * Il risultato viene restituito come Poi "place" così da riusare la
 * scheda di navigazione già esistente.
 */
export function MapSearchBar({
  origin,
  onSelect,
  onMapInteractionLockChange,
  onOpenChange,
}: {
  origin: [number, number] | null;
  onSelect: (poi: Poi) => void;
  onMapInteractionLockChange?: (locked: boolean) => void;
  /** Notifica il parent quando la ricerca si apre/chiude (per liberare spazio). */
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpenState] = useState(false);
  const [value, setValue] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const tokenRef = useRef<any>(null);
  const debounceRef = useRef<number | null>(null);
  const reqIdRef = useRef(0);

  const setOpen = (v: boolean) => {
    setOpenState(v);
    onOpenChange?.(v);
  };

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    return () => onMapInteractionLockChange?.(false);
  }, [onMapInteractionLockChange]);


  useEffect(() => {
    if (!open) return;
    const q = value.trim();
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (q.length < 3) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    debounceRef.current = window.setTimeout(async () => {
      const reqId = ++reqIdRef.current;

      const serverSearch = async () => {
        const { searchPlaces } = await import("@/lib/geosearch.functions");
        const { results } = await searchPlaces({
          data: origin ? { q, lat: origin[0], lng: origin[1] } : { q },
        });
        if (reqId !== reqIdRef.current) return;
        setItems(
          results.map((r) => ({
            id: r.id,
            primary: r.name,
            secondary: r.address,
            resolve: async () => ({
              id: `place:${r.id}`,
              category: "place" as const,
              lat: r.lat,
              lng: r.lng,
              name: r.name,
              tags: r.address ? { indirizzo: r.address } : undefined,
            }),
          })),
        );
      };

      try {
        await loadGoogleMaps(["places"]);
        const g = (window as any).google;
        const { AutocompleteSuggestion, AutocompleteSessionToken } =
          await g.maps.importLibrary("places");
        if (!tokenRef.current) tokenRef.current = new AutocompleteSessionToken();

        const request: Record<string, unknown> = {
          input: q,
          sessionToken: tokenRef.current,
          language: "it",
          region: "it",
        };
        if (origin) {
          request.locationBias = {
            center: { lat: origin[0], lng: origin[1] },
            radius: 40000,
          };
        }
        const { suggestions } =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        if (reqId !== reqIdRef.current) return;

        setItems(
          (suggestions ?? [])
            .filter((s: any) => s.placePrediction)
            .slice(0, 6)
            .map((s: any) => {
              const pred = s.placePrediction;
              return {
                id: pred.placeId,
                primary: pred.mainText?.text ?? pred.text?.text ?? "",
                secondary: pred.secondaryText?.text ?? "",
                resolve: async () => {
                  const place = pred.toPlace();
                  await place.fetchFields({
                    fields: ["displayName", "formattedAddress", "location"],
                  });
                  const loc = place.location;
                  if (!loc) return null;
                  tokenRef.current = null; // chiude la sessione di autocomplete
                  return {
                    id: `place:${pred.placeId}`,
                    category: "place" as const,
                    lat: typeof loc.lat === "function" ? loc.lat() : loc.lat,
                    lng: typeof loc.lng === "function" ? loc.lng() : loc.lng,
                    name: place.displayName ?? pred.mainText?.text ?? "Destinazione",
                    tags: place.formattedAddress
                      ? { indirizzo: place.formattedAddress }
                      : undefined,
                  };
                },
              };
            }),
        );
      } catch {
        // Places API (New) non abilitata sulla chiave o errore rete:
        // ricerca alternativa lato server (Google Places server / OpenStreetMap).
        try {
          await serverSearch();
        } catch (e2: any) {
          if (reqId !== reqIdRef.current) return;
          setItems([]);
          setError(e2?.message ?? "Ricerca non disponibile");
        }
      } finally {
        if (reqId === reqIdRef.current) setLoading(false);
      }
    }, 300);


    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [value, open, origin]);

  const pick = async (s: Suggestion) => {
    setLoading(true);
    try {
      const poi = await s.resolve();
      if (poi) {
        onSelect(poi);
        setOpen(false);
        setValue("");
        setItems([]);
      } else {
        setError("Posizione non disponibile per questo luogo");
      }
    } catch (e: any) {
      setError(e?.message ?? "Impossibile aprire il luogo");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full app-glass px-2 text-left shadow-lg sm:px-3"
        aria-label="Cerca un luogo o un indirizzo"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-cicla text-cicla-foreground">
          <Search size={13} strokeWidth={2.8} />
        </span>
        {/* Su schermi molto stretti resta solo l'icona: niente testo compresso. */}
        <span className="hidden min-w-0 truncate text-[11px] font-medium text-foreground/80 min-[340px]:inline">
          Cerca percorsi…
        </span>
      </button>
    );
  }

  return (
    <div className="pointer-events-auto min-w-0 flex-1">
      <div className="flex h-9 items-center gap-2 rounded-full app-glass px-2 shadow-lg sm:px-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-cicla text-cicla-foreground">
          <Search size={13} strokeWidth={2.8} />
        </span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => onMapInteractionLockChange?.(true)}
          onBlur={() => onMapInteractionLockChange?.(false)}
          maxLength={120}
          enterKeyHint="search"
          placeholder="Indirizzo o luogo…"
          /* 16px: sotto questa soglia iOS zooma automaticamente al focus */
          className="min-w-0 flex-1 bg-transparent text-[16px] font-medium leading-tight text-foreground outline-none placeholder:text-muted-foreground"

        />
        {loading && <Loader2 size={13} className="shrink-0 animate-spin text-muted-foreground" />}
        <button
          type="button"
          onClick={() => {
            onMapInteractionLockChange?.(false);
            setOpen(false);
            setValue("");
            setItems([]);
            setError(null);
          }}
          aria-label="Chiudi ricerca"
          className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <X size={14} />
        </button>
      </div>


      {(items.length > 0 || error) && (
        <div className="mt-1.5 overflow-hidden rounded-2xl app-glass-strong shadow-2xl">
          {error && (
            <p className="px-3 py-2 text-[11px] text-destructive">{error}</p>
          )}
          {items.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => pick(s)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/5"
            >
              <MapPin size={13} className="shrink-0 text-cicla" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium">{s.primary}</span>
                {s.secondary && (
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {s.secondary}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
