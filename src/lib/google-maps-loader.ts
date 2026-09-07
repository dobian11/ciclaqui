// Carica Google Maps JS API una sola volta (async + callback) e ritorna la
// reference globale `google`. Usato da GoogleMapView e dall'autocomplete.
//
// La browser key è referrer-restricted (gestita dal connector Google Maps).
// Il channel ID serve a Lovable per tracciare l'uso.

let loadPromise: Promise<typeof google> | null = null;
let authFailed = false;

declare global {
  // eslint-disable-next-line no-var
  var google: any;
  interface Window {
    __ciclaInitGoogleMaps?: () => void;
    gm_authFailure?: () => void;
  }
}

export const GOOGLE_MAPS_AUTH_ERROR_EVENT = "cicla:google-maps-auth-error";

// I domini serviti dalla chiave gestita da Lovable.
const LOVABLE_HOSTS = [".lovable.app", ".lovableproject.com"];

function isLovableHost() {
  const h = window.location.hostname;
  return LOVABLE_HOSTS.some((d) => h.endsWith(d)) || h === "localhost" || h === "127.0.0.1";
}

const KEY_CACHE = "cicla:gmaps-key-v2";

async function resolveKey(): Promise<string | null> {
  const managed = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as
    | string
    | undefined;
  // Sul dominio custom la chiave gestita è bloccata dal referrer restriction:
  // usiamo la chiave Google dell'utente esposta dal server.
  if (!isLovableHost()) {
    // Cache di sessione: evita un round-trip al server ad ogni ricarica.
    try {
      const cached = sessionStorage.getItem(KEY_CACHE);
      if (cached) return cached;
    } catch {
      /* storage non disponibile */
    }
    try {
      const { getMapsBrowserKey } = await import("@/lib/maps-key.functions");
      const res = await getMapsBrowserKey();
      if (res?.key) {
        try {
          sessionStorage.setItem(KEY_CACHE, res.key);
        } catch {
          /* ignore */
        }
        return res.key;
      }
    } catch {
      /* fallback sotto */
    }
  }
  return managed ?? null;
}

export function loadGoogleMaps(libraries: string[] = ["places", "geometry"]): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps requires browser"));
  }
  if (authFailed) {
    return Promise.reject(new Error("Chiave Google Maps non valida"));
  }
  // Con loading=async la callback può scattare prima che le classi (Map, Size…)
  // siano pronte: considerate caricate solo se il costruttore Map esiste.
  if ((window as any).google?.maps?.Map) {
    return Promise.resolve((window as any).google);
  }
  if (loadPromise) return loadPromise;

  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;

  loadPromise = new Promise(async (resolve, reject) => {
    const key = await resolveKey();
    if (!key) {
      loadPromise = null;
      reject(new Error("Missing Google Maps browser key (connector not linked?)"));
      return;
    }

    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      loadPromise = null;
      reject(new Error("Google Maps non risponde"));
    }, 10_000);

    window.gm_authFailure = () => {
      authFailed = true;
      // La chiave in cache potrebbe essere quella non valida: la scartiamo
      // così al prossimo caricamento viene richiesta di nuovo al server.
      try {
        sessionStorage.removeItem(KEY_CACHE);
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent(GOOGLE_MAPS_AUTH_ERROR_EVENT));
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      loadPromise = null;
      reject(new Error("Chiave Google Maps non valida"));
    };

    window.__ciclaInitGoogleMaps = () => {
      const g = (window as any).google;
      // Con caricamento async le librerie vanno esplicitamente importate:
      // senza importLibrary("maps") `new google.maps.Map(...)` lancia
      // "google.maps.Map is not a constructor".
      const wanted = ["maps", ...libraries];
      Promise.all(
        wanted.map((lib) =>
          g.maps.importLibrary(lib).catch(() => null),
        ),
      ).then(() => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve(g);
      });
    };

    const script = document.createElement("script");
    const params = new URLSearchParams({
      key,
      loading: "async",
      callback: "__ciclaInitGoogleMaps",
      libraries: libraries.join(","),
    });
    if (channel) params.set("channel", channel);

    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.dataset.ciclaGoogleMaps = "true";
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      loadPromise = null;
      reject(new Error("Failed to load Google Maps JS"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Avvia il download dell'SDK (e la risoluzione della chiave) quando il browser
 * è inattivo, così la mappa è già pronta quando l'utente apre la scheda Mappa.
 * Non blocca il first render: gira in idle e ignora gli errori.
 */
export function prefetchGoogleMaps() {
  if (typeof window === "undefined") return;
  if ((window as any).google?.maps || loadPromise) return;
  const run = () => {
    loadGoogleMaps().catch(() => {
      /* la schermata mappa mostrerà l'errore reale */
    });
  };
  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => number)
    | undefined;
  if (ric) ric(run, { timeout: 2500 });
  else window.setTimeout(run, 400);
}

