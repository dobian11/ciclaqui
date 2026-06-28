import { useEffect, useMemo, useState } from "react";
import { MapPin, AlertTriangle, Settings, RefreshCw, X, ShieldOff, SatelliteDish } from "lucide-react";
import type { GeoError } from "@/lib/use-geolocation";

type PermState = "prompt" | "granted" | "denied" | "unknown";

interface Props {
  error: GeoError | null;
  loading: boolean;
  hasPosition: boolean;
  onRetry: () => void;
}

/**
 * Flusso permessi GPS — mostra una scheda dedicata quando:
 *  • il sistema operativo non ha ancora chiesto il permesso (Permissions API = prompt)
 *  • l'utente ha negato (denied)
 *  • i servizi di localizzazione sono spenti (unavailable)
 *  • il fix è scaduto (timeout)
 *
 * Non si sovrappone all'onboarding educativo: appare solo dopo, quando c'è
 * un problema concreto da risolvere.
 */
export function GpsPermissionSheet({ error, loading, hasPosition, onRetry }: Props) {
  const [perm, setPerm] = useState<PermState>("unknown");
  const [dismissed, setDismissed] = useState(false);

  // Poll Permissions API — Safari iOS non supporta, restiamo su "unknown"
  useEffect(() => {
    let cancelled = false;
    let permStatus: PermissionStatus | null = null;
    const handler = () => {
      if (permStatus && !cancelled) setPerm(permStatus.state as PermState);
    };
    (async () => {
      try {
        if (typeof navigator === "undefined" || !navigator.permissions?.query) return;
        permStatus = await navigator.permissions.query({ name: "geolocation" as PermissionName });
        if (cancelled) return;
        setPerm(permStatus!.state as PermState);
        permStatus!.addEventListener("change", handler);
      } catch { /* unsupported */ }
    })();
    return () => {
      cancelled = true;
      try { permStatus?.removeEventListener("change", handler); } catch { /* noop */ }
    };
  }, []);

  // Reset dismiss quando cambia natura dell'errore
  useEffect(() => { setDismissed(false); }, [error?.code, perm]);

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const platform: "ios" | "android" | "desktop" = useMemo(() => {
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
    if (/Android/i.test(ua)) return "android";
    return "desktop";
  }, [ua]);

  const variant: null | "prompt" | "denied" | "unavailable" | "timeout" | "unsupported" = useMemo(() => {
    if (hasPosition) return null;
    if (error?.code === "denied" || perm === "denied") return "denied";
    if (error?.code === "unavailable") return "unavailable";
    if (error?.code === "timeout") return "timeout";
    if (error?.code === "unsupported") return "unsupported";
    if (perm === "prompt" && !loading) return "prompt";
    return null;
  }, [error, perm, hasPosition, loading]);

  if (!variant || dismissed) return null;

  const cfg = (() => {
    switch (variant) {
      case "denied":
        return {
          Icon: ShieldOff,
          tone: "destructive" as const,
          title: "Permesso posizione negato",
          body: "Senza il GPS non possiamo tracciare i tuoi viaggi né assegnare i punti. Riattivalo dalle impostazioni del telefono per continuare.",
          steps: platform === "ios"
            ? ["Impostazioni → Privacy → Localizzazione", "Cerca «Cicla Qui» → seleziona «Sempre» o «Mentre usi»"]
            : platform === "android"
              ? ["Impostazioni → App → Cicla Qui → Autorizzazioni", "Posizione → consenti «Sempre»"]
              : ["Icona lucchetto nella barra indirizzi", "Posizione → Consenti, poi ricarica"],
          cta: "Ho riattivato, riprova",
        };
      case "unavailable":
        return {
          Icon: SatelliteDish,
          tone: "warning" as const,
          title: "Servizi di localizzazione non disponibili",
          body: "Il dispositivo non riesce a leggere un fix GPS. Controlla che la localizzazione di sistema sia accesa e di essere in un'area con segnale.",
          steps: platform === "ios"
            ? ["Impostazioni → Privacy → Localizzazione → ON", "Disattiva la Modalità Aereo"]
            : platform === "android"
              ? ["Impostazioni rapide → Posizione → ON", "Modalità: Alta precisione (GPS + Wi-Fi)"]
              : ["Attiva i servizi di localizzazione del sistema operativo"],
          cta: "Riprova",
        };
      case "timeout":
        return {
          Icon: RefreshCw,
          tone: "warning" as const,
          title: "Nessun fix GPS",
          body: "Ci stiamo provando ma il segnale è troppo debole. Spostati all'aperto o vicino a una finestra e riprova.",
          steps: ["Evita gallerie e interni schermati", "Tieni il telefono lontano da custodie metalliche"],
          cta: "Riprova ora",
        };
      case "unsupported":
        return {
          Icon: AlertTriangle,
          tone: "destructive" as const,
          title: "Browser non supportato",
          body: "Questo dispositivo non espone l'API di geolocalizzazione. Usa Cicla Qui dall'app mobile o un browser moderno (Chrome, Safari, Edge).",
          steps: [],
          cta: "Riprova",
        };
      case "prompt":
      default:
        return {
          Icon: MapPin,
          tone: "info" as const,
          title: "Attiva la tua posizione",
          body: "Quando appare il pop-up di sistema tocca «Consenti». Il GPS è la base di Cicla Qui: senza non possiamo tracciare i viaggi né assegnare punti.",
          steps: [],
          cta: "Consenti posizione",
        };
    }
  })();

  const Icon = cfg.Icon;
  const toneClasses =
    cfg.tone === "destructive"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : cfg.tone === "warning"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
        : "border-cicla/40 bg-cicla/10 text-cicla";

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-[1500] flex justify-center px-3 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className={`grid size-11 shrink-0 place-items-center rounded-2xl border ${toneClasses}`}>
            <Icon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-sm font-bold leading-tight">{cfg.title}</h3>
              <button
                type="button"
                aria-label="Chiudi"
                onClick={() => setDismissed(true)}
                className="grid size-6 place-items-center rounded-full text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{cfg.body}</p>
            {cfg.steps.length > 0 && (
              <ol className="mt-2 space-y-1 text-[11px] text-muted-foreground/90">
                {cfg.steps.map((s, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-cicla">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-full bg-cicla px-4 py-1.5 text-xs font-semibold text-cicla-foreground shadow-cicla"
              >
                <RefreshCw size={12} />
                {cfg.cta}
              </button>
              {variant === "denied" && platform !== "desktop" && (
                <a
                  href={platform === "ios" ? "app-settings:" : "intent://settings#Intent;scheme=android-app;end"}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/50 px-4 py-1.5 text-xs font-medium text-foreground hover:bg-background"
                >
                  <Settings size={12} />
                  Apri impostazioni
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
