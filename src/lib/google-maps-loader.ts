// Carica Google Maps JS API una sola volta (async + callback) e ritorna la
// reference globale `google`. Usato da GoogleMapView e dall'autocomplete.
//
// La browser key è referrer-restricted (gestita dal connector Google Maps).
// Il channel ID serve a Lovable per tracciare l'uso.

let loadPromise: Promise<typeof google> | null = null;

declare global {
  // eslint-disable-next-line no-var
  var google: any;
  interface Window {
    __ciclaInitGoogleMaps?: () => void;
  }
}

// I domini serviti dalla chiave gestita da Lovable.
const LOVABLE_HOSTS = [".lovable.app", ".lovableproject.com"];

function isLovableHost() {
  const h = window.location.hostname;
  return LOVABLE_HOSTS.some((d) => h.endsWith(d)) || h === "localhost" || h === "127.0.0.1";
}

async function resolveKey(): Promise<string | null> {
  const managed = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as
    | string
    | undefined;
  // Sul dominio custom la chiave gestita è bloccata dal referrer restriction:
  // usiamo la chiave Google dell'utente esposta dal server.
  if (!isLovableHost()) {
    try {
      const { getMapsBrowserKey } = await import("@/lib/maps-key.functions");
      const res = await getMapsBrowserKey();
      if (res?.key) return res.key;
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
  if ((window as any).google?.maps) {
    return Promise.resolve((window as any).google);
  }
  if (loadPromise) return loadPromise;

  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;

  loadPromise = new Promise(async (resolve, reject) => {
    const key = await resolveKey();
    if (!key) {
      reject(new Error("Missing Google Maps browser key (connector not linked?)"));
      return;
    }

    window.__ciclaInitGoogleMaps = () => {
      resolve((window as any).google);
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
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps JS"));
    document.head.appendChild(script);
  });

  return loadPromise;
}
