import { createFileRoute } from "@tanstack/react-router";
import { Bike, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/bici")({
  component: BiciPlaceholder,
});

function BiciPlaceholder() {
  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-md px-5 py-6">
        <h1 className="text-2xl font-bold tracking-tight">Le tue bici</h1>
        <p className="mt-1 text-sm text-muted-foreground">Passaporto digitale, QR e antifurto.</p>

        <div className="mt-8 grid place-items-center rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center">
          <div className="grid size-16 place-items-center rounded-full bg-cicla/10 text-cicla">
            <Bike size={28} />
          </div>
          <h2 className="mt-4 font-display text-lg font-semibold">Nessuna bici ancora</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Aggiungeremo la creazione del passaporto bici nello Sprint 3.
          </p>
          <button
            type="button"
            disabled
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-cicla px-4 py-2 text-sm font-semibold text-cicla-foreground opacity-50"
          >
            <Plus size={16} /> Aggiungi bici
          </button>
        </div>
      </div>
    </div>
  );
}
