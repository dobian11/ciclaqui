import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Download, Share, X, PlusSquare } from "lucide-react";

const DISMISS_KEY = "ciclaqui-install-dismissed";

type DeferredPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/** Banner "Installa l'app" mostrato dopo l'accesso (solo web/PWA, mai su nativo). */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<DeferredPrompt | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform() || isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as DeferredPrompt);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // Su iOS non esiste beforeinstallprompt: mostriamo le istruzioni manuali.
    if (isIos()) setShow(true);

    const onInstalled = () => setShow(false);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setShow(false);
      setDeferred(null);
    } else if (isIos()) {
      setIosHint((v) => !v);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+88px)]">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl app-glass-strong p-4 shadow-lg ring-1 ring-cicla/30">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cicla/15 text-cicla">
            <Download size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold">Installa Cicla Qui</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              Aggiungila alla schermata Home: si apre a tutto schermo, più veloce.
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Chiudi"
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {iosHint && (
          <div className="mt-3 rounded-xl bg-foreground/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <p className="flex items-center gap-1.5">
              1. Tocca <Share size={13} className="text-info" /> <strong className="text-foreground">Condividi</strong> in Safari
            </p>
            <p className="mt-1.5 flex items-center gap-1.5">
              2. Tocca <PlusSquare size={13} className="text-info" /> <strong className="text-foreground">Aggiungi a Home</strong>
            </p>
          </div>
        )}

        <button
          onClick={install}
          className="mt-3 h-10 w-full rounded-xl bg-cicla text-sm font-bold text-cicla-foreground active:scale-[0.98] transition-transform"
        >
          {deferred ? "Installa ora" : "Come si installa?"}
        </button>
      </div>
    </div>
  );
}
