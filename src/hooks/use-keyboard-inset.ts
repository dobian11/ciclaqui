import { useEffect, useState } from "react";

/**
 * Restituisce quanti px del fondo dello schermo sono coperti da chrome del
 * browser (toolbar iOS Safari) o dalla tastiera software. Con
 * `interactive-widget=overlays-content` il layout viewport non si riduce,
 * quindi l'ostruzione va misurata come differenza tra innerHeight e il
 * visual viewport (altezza + offset). In PWA standalone vale 0 e si usa
 * il fallback con env(safe-area-inset-bottom).
 */
export function useViewportBottomInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const covered = Math.max(
        0,
        Math.round(window.innerHeight - vv.height - vv.offsetTop),
      );
      setInset(covered);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return inset;
}

/**
 * Come useViewportBottomInset, ma considera solo la tastiera software:
 * valori sotto gli 80px (barre del browser che compaiono/scompaiono)
 * vengono ignorati. Restituisce 0 quando la tastiera è chiusa.
 */
export function useKeyboardInset() {
  const inset = useViewportBottomInset();
  return inset > 80 ? inset : 0;
}
