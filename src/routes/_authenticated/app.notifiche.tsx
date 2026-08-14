import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Bell, BellRing, ChevronLeft, Mail, Smartphone, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePush } from "@/hooks/use-push";
import { NotificationsSection } from "@/components/cicla/NotificationsSection";

export const Route = createFileRoute("/_authenticated/app/notifiche")({
  component: NotifichePage,
  head: () => ({
    meta: [
      { title: "Notifiche — Cicla Qui" },
      { name: "description", content: "Scegli quali notifiche ricevere dentro l'app e via email: streak, sfide, bici, premi e comunicazioni del tuo ente." },
      { property: "og:title", content: "Impostazioni notifiche — Cicla Qui" },
      { property: "og:description", content: "Gestisci le preferenze di notifica in-app ed email di Cicla Qui." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Prefs = {
  inapp_streak: boolean; inapp_challenges: boolean; inapp_bike: boolean; inapp_trip_flag: boolean; inapp_rewards: boolean; inapp_company: boolean;
  email_streak: boolean; email_challenges: boolean; email_bike: boolean; email_trip_flag: boolean; email_rewards: boolean; email_company: boolean; email_product: boolean;
  push_streak: boolean; push_challenges: boolean; push_bike: boolean; push_trip_flag: boolean; push_rewards: boolean; push_company: boolean;
};

const DEFAULTS: Prefs = {
  inapp_streak: true, inapp_challenges: true, inapp_bike: true, inapp_trip_flag: true, inapp_rewards: true, inapp_company: true,
  email_streak: false, email_challenges: true, email_bike: true, email_trip_flag: true, email_rewards: false, email_company: true, email_product: false,
  push_streak: true, push_challenges: true, push_bike: true, push_trip_flag: true, push_rewards: true, push_company: true,
};

type Row = {
  key: "streak" | "challenges" | "bike" | "trip_flag" | "rewards" | "company";
  label: string;
  desc: string;
  email: boolean;
};

const ROWS: Row[] = [
  { key: "streak", label: "Streak a rischio", desc: "Ti avvisiamo se stai per perdere la serie di giorni attivi.", email: true },
  { key: "challenges", label: "Sfide e traguardi", desc: "Nuove sfide, progressi e sfide completate.", email: true },
  { key: "bike", label: "Bici e segnalazioni", desc: "Avvistamenti, recuperi e aggiornamenti sul passaporto bici.", email: true },
  { key: "trip_flag", label: "Viaggi da rivedere", desc: "Quando un viaggio viene messo in revisione o sbloccato.", email: true },
  { key: "rewards", label: "Premi disponibili", desc: "Nuovi premi del tuo ente e conferme di riscatto.", email: true },
  { key: "company", label: "Comunicazioni dell'ente", desc: "Messaggi e aggiornamenti dalla tua azienda o dal tuo comune.", email: true },
];

function NotifichePage() {
  const router = useRouter();
  const push = usePush();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("notification_preferences").select("*").maybeSingle();
      if (data) setPrefs((p) => ({ ...p, ...(data as Partial<Prefs>) }));
      setLoading(false);
    })();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  function update(patch: Partial<Prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(next), 500);
  }

  async function persist(next: Prefs) {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error("Impossibile salvare le preferenze");
  }

  const allInApp = useMemo(() => ROWS.every((r) => prefs[`inapp_${r.key}` as keyof Prefs]), [prefs]);
  const allEmail = useMemo(() => ROWS.every((r) => prefs[`email_${r.key}` as keyof Prefs]), [prefs]);

  function toggleColumn(channel: "inapp" | "email", value: boolean) {
    const patch: Partial<Prefs> = {};
    for (const r of ROWS) (patch as Record<string, boolean>)[`${channel}_${r.key}`] = value;
    if (channel === "inapp") for (const r of ROWS) (patch as Record<string, boolean>)[`push_${r.key}`] = value;
    update(patch);
  }

  return (
    <div className="h-full overflow-y-auto bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={() => router.history.back()} aria-label="Indietro" className="grid size-9 place-items-center rounded-full bg-card">
          <ChevronLeft size={18} />
        </button>
        <h1 className="font-display text-lg font-bold">Notifiche</h1>
        <span className="ml-auto text-[11px] text-muted-foreground">{saving ? "Salvataggio…" : loading ? "" : "Salvato ✓"}</span>
      </header>

      <div className="space-y-4 px-4 py-4">
        <p className="text-xs text-muted-foreground">
          Scegli per ogni tipo di avviso se riceverlo dentro l'app (centro notifiche e push) oppure via email.
        </p>

        <NotificationsSection alwaysShow />

        <div className="rounded-2xl border border-border bg-card/50 p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-cicla/15 text-cicla"><Bell size={18} /></div>
            <h2 className="font-display text-sm font-bold">Tutte le categorie</h2>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => toggleColumn("inapp", !allInApp)}
              className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-[11px] font-semibold"
            >
              <Smartphone size={14} /> {allInApp ? "Disattiva in-app" : "Attiva tutte in-app"}
            </button>
            <button
              onClick={() => toggleColumn("email", !allEmail)}
              className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-[11px] font-semibold"
            >
              <Mail size={14} /> {allEmail ? "Disattiva email" : "Attiva tutte email"}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card/50">
          <div className="grid grid-cols-[1fr_54px_54px] items-center gap-2 border-b border-border px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Categoria</span>
            <span className="text-center">In-app</span>
            <span className="text-center">Email</span>
          </div>
          {ROWS.map((r) => (
            <div key={r.key} className="grid grid-cols-[1fr_54px_54px] items-center gap-2 border-b border-border/60 px-4 py-3 last:border-b-0">
              <div>
                <p className="text-xs font-semibold">{r.label}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{r.desc}</p>
              </div>
              <div className="flex justify-center">
                <input
                  type="checkbox"
                  aria-label={`${r.label} in app`}
                  className="size-4 accent-cicla"
                  checked={Boolean(prefs[`inapp_${r.key}` as keyof Prefs])}
                  onChange={(e) => {
                    const v = e.target.checked;
                    const patch: Partial<Prefs> = { [`inapp_${r.key}`]: v } as Partial<Prefs>;
                    (patch as Record<string, boolean>)[`push_${r.key}`] = v;
                    update(patch);
                  }}
                />
              </div>
              <div className="flex justify-center">
                <input
                  type="checkbox"
                  aria-label={`${r.label} via email`}
                  className="size-4 accent-cicla"
                  checked={Boolean(prefs[`email_${r.key}` as keyof Prefs])}
                  onChange={(e) => update({ [`email_${r.key}`]: e.target.checked } as Partial<Prefs>)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card/50 p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-cicla/15 text-cicla"><Mail size={18} /></div>
            <h2 className="font-display text-sm font-bold">Email di prodotto</h2>
          </div>
          <label className="mt-3 flex items-center justify-between rounded-xl bg-card/60 px-3 py-2">
            <span className="pr-3 text-xs">Novità, consigli e aggiornamenti su Cicla Qui</span>
            <input
              type="checkbox"
              className="size-4 accent-cicla"
              checked={prefs.email_product}
              onChange={(e) => update({ email_product: e.target.checked })}
            />
          </label>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Le email di servizio (sicurezza, verifica account, esiti verifica ente) vengono sempre inviate.
          </p>
        </div>

        <PushCard />


        <Link to="/app/privacy" preload="intent" className="flex items-center gap-2 rounded-2xl border border-border bg-card/50 px-4 py-3 text-xs font-semibold">
          <ShieldCheck size={16} className="text-cicla" /> Privacy e dati personali
        </Link>
      </div>
    </div>
  );
}
