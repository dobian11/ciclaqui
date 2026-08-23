import { useEffect, useState } from "react";

/**
 * Restituisce l'altezza in px della tastiera software (0 quando è chiusa).
 * Usa window.visualViewport: con `interactive-widget=overlays-content` il
 * layout viewport non si riduce, quindi la tastiera va misurata come
 * differenza tra innerHeight e l'altezza del visual viewport.
 */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const keyboard = Math.max(
        0,
        Math.round(window.innerHeight - vv.height - vv.offsetTop),
      );
      // Ignora riduzioni minime (barre del browser che compaiono/scompaiono).
      setInset(keyboard > 80 ? keyboard : 0);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
