import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CiclaLogo } from "@/components/cicla/CiclaLogo";
import { Button } from "@/components/ui/button";
import { Bike, Building2, Leaf, MapPin, ShieldCheck, Coins } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      throw redirect({ to: "/app" });
    }
  },
  head: () => ({
    meta: [
      { title: "Cicla Qui · Mobilità sostenibile che premia" },
      {
        name: "description",
        content:
          "Cicla Qui premia i tuoi spostamenti sostenibili. Per persone e aziende: punti, sicurezza e passaporto bici antifurto.",
      },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/40 to-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
        <header className="flex items-center justify-between">
          <CiclaLogo size="md" />
        </header>

        <section className="mt-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cicla/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cicla">
            <Leaf size={12} /> Mobilità che premia
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight">
            Muoviti green.
            <br />
            <span className="text-cicla">Guadagna davvero.</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Cicla Qui traccia i tuoi spostamenti in bici o a piedi, ti protegge dai furti
            con il passaporto della bicicletta e trasforma i tuoi chilometri in punti
            convertibili in denaro. Per le persone e per le aziende che vogliono premiare
            la sostenibilità dei propri dipendenti.
          </p>
        </section>

        <section className="mt-8 grid grid-cols-2 gap-3">
          <FeatureCard icon={<MapPin size={18} />} title="Mappa & tracker" desc="Posizione precisa, rilevamento automatico del mezzo." />
          <FeatureCard icon={<Coins size={18} />} title="Punti reali" desc="10 punti = 0,10 €. Prelievo sicuro via Stripe." />
          <FeatureCard icon={<ShieldCheck size={18} />} title="Antifurto" desc="Passaporto bici e segnalazione furti pubblica." />
          <FeatureCard icon={<Building2 size={18} />} title="Per aziende" desc="Codice univoco, dashboard, premi ai dipendenti." />
        </section>

        <div className="mt-auto pt-10 space-y-3">
          <Button asChild className="w-full h-12 text-base shadow-cicla">
            <Link to="/auth">
              <Bike className="mr-1" /> Inizia come persona
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full h-12 text-base">
            <Link to="/azienda/auth">
              <Building2 className="mr-1" /> Sono un'azienda
            </Link>
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Hai già un account?{" "}
            <Link to="/auth" className="font-semibold text-foreground underline-offset-2 hover:underline">
              Accedi
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-cicla/10 text-cicla">
        {icon}
      </div>
      <div className="mt-3 text-sm font-semibold leading-tight">{title}</div>
      <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{desc}</div>
    </div>
  );
}
