import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type Consent = { necessary: true; analytics: boolean; marketing: boolean };
const KEY = "cicla:cookie-consent:v1";

export function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  async function save(c: Consent) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...c, at: Date.now() }));
    } catch { /* ignore */ }
    setOpen(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("cookie_consents").insert({
        user_id: user?.id ?? null,
        necessary: true,
        analytics: c.analytics,
        marketing: c.marketing,
        user_agent: navigator.userAgent.slice(0, 200),
      });
    } catch { /* best effort */ }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[2000] px-3 pb-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 12px)" }}>
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-xl">
        <h3 className="font-display text-sm font-bold">Cookie & privacy</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Usiamo cookie tecnici (sempre attivi) e, con il tuo consenso, cookie analitici e di marketing. Vedi la nostra{" "}
          <Link to="/legal/cookie" className="text-cicla underline">cookie policy</Link>.
        </p>

        {custom && (
          <div className="mt-3 space-y-2">
            <Row label="Necessari" desc="Sessione, sicurezza." value disabled />
            <Row label="Analitici" desc="Statistiche aggregate." value={analytics} onChange={setAnalytics} />
            <Row label="Marketing" desc="Comunicazioni personalizzate." value={marketing} onChange={setMarketing} />
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => save({ necessary: true, analytics: false, marketing: false })} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold">Solo necessari</button>
          {!custom && <button onClick={() => setCustom(true)} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold">Personalizza</button>}
          {custom && <button onClick={() => save({ necessary: true, analytics, marketing })} className="rounded-full bg-foreground/90 px-3 py-1.5 text-xs font-semibold text-background">Salva scelte</button>}
          <button onClick={() => save({ necessary: true, analytics: true, marketing: true })} className="ml-auto rounded-full bg-cicla px-3 py-1.5 text-xs font-bold text-cicla-foreground">Accetta tutti</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, desc, value, onChange, disabled }: { label: string; desc: string; value: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl bg-background/50 px-3 py-2">
      <div>
        <div className="text-xs font-semibold">{label}</div>
        <div className="text-[10px] text-muted-foreground">{desc}</div>
      </div>
      <input type="checkbox" checked={value} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} className="size-4 accent-cicla" />
    </label>
  );
}
