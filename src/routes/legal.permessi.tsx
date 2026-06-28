import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Bell, Activity, Camera } from "lucide-react";

export const Route = createFileRoute("/legal/permessi")({
  head: () => ({ meta: [{ title: "Permessi richiesti — Cicla Qui" }] }),
  component: PermessiPage,
});

function PermessiPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link to="/" className="text-xs uppercase tracking-wider text-muted-foreground">← Home</Link>
        <h1 className="mt-4 font-display text-3xl font-bold">Perché Cicla Qui chiede questi permessi</h1>
        <p className="mt-2 text-sm text-muted-foreground">Trasparenza totale: ecco cosa usiamo, quando e perché.</p>

        <Perm icon={MapPin} title="Posizione (sempre)" why="Per registrare i tuoi viaggi anche quando l'app è in background o lo schermo è bloccato. Senza questo permesso il tracking si interrompe e non guadagni punti." note="Puoi sempre revocarlo dalle impostazioni del telefono." />
        <Perm icon={Activity} title="Movimento e orientamento" why="Accelerometro e bussola ci aiutano a distinguere se sei in bici, a piedi o in auto quando il GPS è ambiguo. Riduce gli errori di accredito punti." note="Non salviamo dati grezzi, solo lo score di classificazione." />
        <Perm icon={Bell} title="Notifiche push" why="Per avvisarti di sfide completate, traguardi raggiunti, segnalazioni sulla tua bici, viaggi da rivedere." note="Personalizzabili in Profilo → Notifiche." />
        <Perm icon={Camera} title="Fotocamera (facoltativo)" why="Per scattare foto del telaio della tua bici nel passaporto e leggere QR code di altri ciclisti." note="Solo quando lo richiedi esplicitamente." />
      </div>
    </div>
  );
}

function Perm({ icon: Icon, title, why, note }: { icon: React.ComponentType<{size?:number}>; title: string; why: string; note: string }) {
  return (
    <div className="mt-5 rounded-2xl border border-border bg-card/50 p-5">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-cicla/15 text-cicla"><Icon size={20} /></div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{why}</p>
      <p className="mt-2 text-xs text-muted-foreground/80 italic">{note}</p>
    </div>
  );
}
