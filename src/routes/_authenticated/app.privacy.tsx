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

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("account_deletion_requests").select("scheduled_for, cancelled_at").maybeSingle();
      setDeletion(data ?? null);
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

  return (
    <div className="app-page bg-background">
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

        <Card icon={Bell} title="Notifiche" desc="Scegli cosa ricevere dentro l'app e via email, categoria per categoria.">
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Link to="/app/notifiche" preload="intent" className="rounded-full bg-cicla px-4 py-2 text-xs font-bold text-cicla-foreground">
              Gestisci notifiche
            </Link>
            <button onClick={() => push.register()} className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold">
              {push.status === "registered" ? "Push attive ✓" : push.status === "unsupported" ? "Disponibile solo su app nativa" : "Attiva push su questo dispositivo"}
            </button>
          </div>
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
