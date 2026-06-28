import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Download, ShieldAlert, Bell, FileText } from "lucide-react";
import { requestDataExport, scheduleAccountDeletion, cancelAccountDeletion } from "@/lib/gdpr.functions";
import { supabase } from "@/integrations/supabase/client";
import { usePush } from "@/hooks/use-push";

export const Route = createFileRoute("/_authenticated/app/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  const router = useRouter();
  const exportFn = useServerFn(requestDataExport);
  const scheduleFn = useServerFn(scheduleAccountDeletion);
  const cancelFn = useServerFn(cancelAccountDeletion);
  const push = usePush();

  const [exporting, setExporting] = useState(false);
  const [deletion, setDeletion] = useState<{ scheduled_for: string; cancelled_at: string | null } | null>(null);
  const [prefs, setPrefs] = useState({ push_streak: true, push_challenges: true, push_bike: true, push_trip_flag: true, push_rewards: true });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("account_deletion_requests").select("scheduled_for, cancelled_at").maybeSingle();
      setDeletion(data ?? null);
      const { data: p } = await supabase.from("notification_preferences").select("*").maybeSingle();
      if (p) setPrefs({ push_streak: p.push_streak, push_challenges: p.push_challenges, push_bike: p.push_bike, push_trip_flag: p.push_trip_flag, push_rewards: p.push_rewards });
    })();
  }, []);

  async function doExport() {
    setExporting(true);
    try {
      const res = await exportFn();
      const blob = new Blob([JSON.stringify(res.json, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `cicla-qui-export-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Export completato");
    } catch (e) { toast.error(String(e)); } finally { setExporting(false); }
  }

  async function savePrefs(next: typeof prefs) {
    setPrefs(next);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("notification_preferences").upsert({ user_id: user.id, ...next });
  }

  return (
    <div className="h-full overflow-y-auto bg-background pb-6">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={() => router.history.back()} className="grid size-9 place-items-center rounded-full bg-card"><ChevronLeft size={18} /></button>
        <h1 className="font-display text-lg font-bold">Privacy & dati</h1>
      </header>

      <div className="space-y-4 px-4 py-4">
        <Card icon={Download} title="Scarica i tuoi dati" desc="Esporta in formato JSON tutto ciò che abbiamo su di te (account, viaggi, bici, punti).">
          <button onClick={doExport} disabled={exporting} className="rounded-full bg-cicla px-4 py-2 text-xs font-bold text-cicla-foreground disabled:opacity-50">
            {exporting ? "Preparazione…" : "Scarica export"}
          </button>
        </Card>

        <Card icon={Bell} title="Notifiche push" desc="Scegli cosa vuoi ricevere.">
          <div className="mt-2 space-y-2">
            {([
              ["push_streak", "Streak a rischio"],
              ["push_challenges", "Sfide & traguardi"],
              ["push_bike", "Bici / segnalazioni"],
              ["push_trip_flag", "Viaggi da rivedere"],
              ["push_rewards", "Nuovi premi"],
            ] as const).map(([k, label]) => (
              <label key={k} className="flex items-center justify-between rounded-xl bg-card/50 px-3 py-2">
                <span className="text-xs">{label}</span>
                <input type="checkbox" checked={prefs[k]} onChange={(e) => savePrefs({ ...prefs, [k]: e.target.checked })} className="size-4 accent-cicla" />
              </label>
            ))}
          </div>
          <button onClick={() => push.register()} className="mt-3 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold">
            {push.status === "registered" ? "Push attive ✓" : push.status === "unsupported" ? "Disponibile solo su app nativa" : "Attiva push su questo dispositivo"}
          </button>
        </Card>

        <Card icon={ShieldAlert} title="Cancella account" desc="Periodo di ripensamento di 30 giorni. Puoi annullare in qualsiasi momento prima della scadenza.">
          {deletion && !deletion.cancelled_at ? (
            <div className="space-y-2">
              <p className="text-xs text-amber-400">Cancellazione programmata per {new Date(deletion.scheduled_for).toLocaleDateString("it-IT")}</p>
              <button onClick={async () => { await cancelFn(); setDeletion({ ...deletion, cancelled_at: new Date().toISOString() }); toast.success("Cancellazione annullata"); }} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold">Annulla cancellazione</button>
            </div>
          ) : (
            <button onClick={async () => { const r = await scheduleFn({ data: {} }); setDeletion({ scheduled_for: r.scheduled_for, cancelled_at: null }); toast.success("Cancellazione programmata"); }} className="rounded-full bg-red-500/90 px-4 py-2 text-xs font-bold text-white">Programma cancellazione</button>
          )}
        </Card>

        <Card icon={FileText} title="Documenti legali">
          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            <Link to="/legal/privacy" className="rounded-full border border-border px-3 py-1.5">Privacy</Link>
            <Link to="/legal/terms" className="rounded-full border border-border px-3 py-1.5">Termini</Link>
            <Link to="/legal/cookie" className="rounded-full border border-border px-3 py-1.5">Cookie</Link>
            <Link to="/legal/permessi" className="rounded-full border border-border px-3 py-1.5">Permessi</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Card({ icon: Icon, title, desc, children }: { icon: React.ComponentType<{size?:number}>; title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4">
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-xl bg-cicla/15 text-cicla"><Icon size={18} /></div>
        <h2 className="font-display text-sm font-bold">{title}</h2>
      </div>
      {desc && <p className="mt-2 text-xs text-muted-foreground">{desc}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}
