import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CiclaLogo } from "@/components/cicla/CiclaLogo";
import { Bike, Building2, ShieldCheck, Gift, MapPin, ArrowRight, Landmark } from "lucide-react";
import { getPostLoginRedirect } from "@/lib/auth-redirect";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const dest = await getPostLoginRedirect();
      throw redirect({ to: dest as never });
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
      { property: "og:title", content: "Cicla Qui · Mobilità sostenibile che premia" },
      {
        property: "og:description",
        content:
          "Trasforma bici e passi in punti riscattabili con i premi della tua azienda o del tuo Comune.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://ciclaqui.it/" },
    ],
    links: [{ rel: "canonical", href: "https://ciclaqui.it/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Cicla Qui",
          serviceType: "Programma di mobilità sostenibile premiata",
          url: "https://ciclaqui.it/",
          areaServed: "IT",
          provider: { "@type": "Organization", name: "Cicla Qui", url: "https://ciclaqui.it" },
          audience: { "@type": "Audience", audienceType: "Dipendenti, cittadini, aziende e comuni" },
          description:
            "Tracciamento GPS degli spostamenti sostenibili, punti riscattabili in premi messi a disposizione da aziende e comuni, e passaporto bici antifurto.",
        }),
      },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Aurora glow background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -left-20 size-[420px] rounded-full bg-cicla opacity-20 blur-[120px]" />
        <div className="absolute top-1/3 -right-24 size-[380px] rounded-full bg-info opacity-10 blur-[120px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-5 pb-8 pt-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 24px)" }}
      >
        <header className="flex items-center justify-between">
          <CiclaLogo size="md" />
          <Link
            to="/auth"
            search={{ mode: "login" }}
            className="rounded-full app-glass px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-foreground/80"
          >
            Accedi
          </Link>
        </header>

        <section className="mt-12">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cicla/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cicla ring-1 ring-cicla/30">
            <span className="size-1.5 rounded-full bg-cicla animate-pulse" /> Mobilità che premia
          </span>
          <h1 className="mt-5 font-display text-[44px] font-bold leading-[1.05] tracking-tight">
            Muoviti green.
            <br />
            <span className="bg-gradient-to-r from-cicla to-info bg-clip-text text-transparent">
              Vinci premi.
            </span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Cicla Qui traccia i tuoi spostamenti sostenibili, protegge la tua bici
            dai furti e trasforma i chilometri in <strong>punti</strong> riscattabili
            con i premi messi a disposizione dalla tua azienda o dal tuo Comune.
          </p>
        </section>

        <section className="mt-8 grid grid-cols-2 gap-3">
          <FeatureCard icon={<MapPin size={16} />} title="Mappa GPS" desc="Rileva auto il mezzo: bici, piedi, auto." />
          <FeatureCard icon={<Gift size={16} />} title="Punti = premi" desc="Voucher, premi e incentivi dedicati." />
          <FeatureCard icon={<ShieldCheck size={16} />} title="Passaporto" desc="Registra la tua bici e rendila riconoscibile in caso di furto." />
          <FeatureCard icon={<Building2 size={16} />} title="Aziende & Comuni" desc="Codice, dashboard, premia il team." />
        </section>

        <div className="mt-auto pt-10 space-y-3">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="group flex h-14 items-center justify-between rounded-2xl bg-cicla px-5 text-cicla-foreground shadow-cicla active:scale-[0.98] transition-transform"
          >
            <span className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-cicla-foreground/10">
                <Bike size={18} />
              </span>
              <span className="font-display text-base font-bold text-left leading-tight">
                Sono un dipendente<br/>
                <span className="text-[11px] font-medium opacity-80">o un cittadino con codice</span>
              </span>
            </span>
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </Link>

          <Link
            to="/azienda/auth"
            search={{ mode: "signup" }}
            className="group flex h-14 items-center justify-between rounded-2xl app-glass-strong px-5 text-foreground active:scale-[0.98] transition-transform"
          >
            <span className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-foreground/10">
                <Landmark size={18} />
              </span>
              <span className="font-display text-base font-bold text-left leading-tight">
                Registra azienda<br/>
                <span className="text-[11px] font-medium text-muted-foreground">o Comune</span>
              </span>
            </span>
            <ArrowRight size={18} className="text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>

          <p className="pt-1 text-center text-[11px] text-muted-foreground">
            Hai già un account?{" "}
            <Link to="/auth" search={{ mode: "login" }} className="font-bold text-foreground underline-offset-2 hover:underline">
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
    <div className="rounded-3xl app-glass p-4">
      <div className="grid h-9 w-9 place-items-center rounded-2xl bg-cicla/15 text-cicla ring-1 ring-cicla/25">
        {icon}
      </div>
      <div className="mt-3 font-display text-sm font-bold leading-tight">{title}</div>
      <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{desc}</div>
    </div>
  );
}
