import { useEffect, useState } from "react";

/**
 * Splash di avvio edge-to-edge: coerente con manifest (background #0a0f0d,
 * theme #00B86B) su iOS/Android. Viene mostrato subito nell'HTML SSR e sparisce
 * appena l'app è idratata, così l'apertura da icona non mostra pagina bianca.
 */
export function BootSplash() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHidden(true), 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      aria-hidden="true"
      data-boot-splash=""
      className={`pointer-events-none fixed inset-0 z-[2000] flex flex-col items-center justify-center gap-4 bg-[#0a0f0d] transition-opacity duration-300 ${
        hidden ? "opacity-0" : "opacity-100"
      }`}
      style={{ visibility: hidden ? "hidden" : "visible" }}
    >
      <img
        src="/icons/icon-192.png"
        alt=""
        width={96}
        height={96}
        className="h-24 w-24 rounded-3xl shadow-[0_0_60px_rgba(0,184,107,0.35)]"
      />
      <p className="text-sm font-medium tracking-tight text-[#00B86B]">Cicla Qui</p>
    </div>
  );
}
