import { useEffect, useState } from "react";
import { MapPin, Activity, Bell, ShieldCheck, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

const STORAGE_KEY = "cicla.permissions.onboarded.v1";

/**
 * Schermata educativa OBBLIGATORIA prima di chiedere i permessi di sistema.
 * Apple richiede di spiegare *perché* serve il GPS in background prima del prompt,
 * altrimenti rifiuta l'app in review. Mostrata una sola volta per device.
 */
export function PermissionsOnboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch { /* ignore */ }
  }, []);

  const finish = async () => {
    try { localStorage.setItem(STORAGE_KEY, new Date().toISOString()); } catch { /* ignore */ }
    // Richiediamo il permesso GPS subito dopo lo step educativo (best practice Apple).
    try {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true, timeout: 5000 });
      }
    } catch { /* ignore */ }
    setOpen(false);
  };

  if (!open) return null;

  const steps = [
    {
      icon: MapPin,
      title: "Posizione, sempre",
      body: "Cicla Qui registra automaticamente i tuoi viaggi anche quando l'app è in background o lo schermo è bloccato. Senza questo permesso il tracking si interrompe e non guadagni punti.",
      note: "Puoi revocarlo in qualsiasi momento dalle impostazioni del telefono.",
    },
    {
      icon: Activity,
      title: "Movimento & orientamento",
      body: "Accelerometro e bussola ci aiutano a distinguere se sei in bici, a piedi o in auto quando il GPS è ambiguo. Riduce gli errori e protegge i tuoi punti.",
      note: "Non salviamo dati grezzi, solo lo score di classificazione.",
    },
    {
      icon: Bell,
      title: "Notifiche",
      body: "Ti avvisiamo solo per cose importanti: sfide completate, viaggi da rivedere, segnalazioni sulla tua bici. Le personalizzi dal Profilo.",
      note: "Niente promozioni, mai.",
    },
    {
      icon: ShieldCheck,
      title: "Privacy by design",
      body: "I tuoi dati restano in UE, cifrati in transito. Puoi esportare o cancellare tutto in qualsiasi momento da Profilo → Privacy.",
      note: "Trasparenza completa nella nostra Privacy Policy.",
    },
  ];

  const s = steps[step];
  const Icon = s.icon;
  const last = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[2000] grid place-items-end bg-background/85 backdrop-blur-sm sm:place-items-center">
      <div className="w-full max-w-md rounded-t-3xl border-t border-border bg-card p-6 shadow-2xl sm:rounded-3xl sm:border">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1 w-6 rounded-full transition-colors ${i <= step ? "bg-cicla" : "bg-white/10"}`}
              />
            ))}
          </div>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {step + 1}/{steps.length}
          </span>
        </div>

        <div className="grid size-14 place-items-center rounded-2xl bg-cicla/15 text-cicla">
          <Icon size={26} />
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold leading-tight">{s.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
        <p className="mt-3 text-xs italic text-muted-foreground/70">{s.note}</p>

        <div className="mt-6 flex items-center justify-between">
          <Link to="/legal/privacy" className="text-[11px] text-muted-foreground underline">
            Privacy policy
          </Link>
          <button
            type="button"
            onClick={() => (last ? finish() : setStep((x) => x + 1))}
            className="inline-flex items-center gap-1.5 rounded-full bg-cicla px-5 py-2.5 text-sm font-semibold text-cicla-foreground shadow-cicla"
          >
            {last ? "Attiva e inizia" : "Avanti"}
            <ChevronRight size={16} />
          </button>
        </div>

        {!last && (
          <button
            type="button"
            onClick={finish}
            className="mt-3 block w-full text-center text-[11px] text-muted-foreground hover:text-foreground"
          >
            Salta introduzione
          </button>
        )}
      </div>
    </div>
  );
}
