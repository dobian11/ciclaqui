import { useEffect } from "react";

/**
 * Mantiene stabile l'altezza della shell dell'app (`--app-shell-h`) quando si
 * apre la tastiera software: la riduzione del viewport dovuta alla tastiera
 * viene ignorata, così mappa e layout non si rimpiccioliscono né si spostano.
 * L'altezza viene aggiornata solo quando cambia l'orientamento/larghezza o
 * quando il viewport torna più alto (tastiera chiusa, barre del browser).
 */
export function useStableViewportHeight() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    let lastWidth = window.innerWidth;
    let lastHeight = 0;

    const apply = (h: number) => {
      lastHeight = h;
      root.style.setProperty("--app-shell-h", `${Math.round(h)}px`);
    };

    apply(window.innerHeight);

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Cambio di orientamento/larghezza: ricalcola sempre.
      if (w !== lastWidth) {
        lastWidth = w;
        apply(h);
        return;
      }
      // Il viewport si è ristretto: quasi certamente è la tastiera → ignora.
      if (h < lastHeight) return;
      apply(h);
    };

    // Evita che iOS faccia scrollare il documento quando appare la tastiera.
    const onFocusIn = () => {
      requestAnimationFrame(() => window.scrollTo(0, 0));
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.removeEventListener("focusin", onFocusIn);
    };
  }, []);
}
