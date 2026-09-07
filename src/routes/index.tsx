import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CiclaLogo } from "@/components/cicla/CiclaLogo";
import {
  Bike, Building2, ShieldCheck, Gift, MapPin, ArrowRight, Landmark,
  Footprints, Leaf, Zap, QrCode, Trophy, Wallet, Sparkles, Route as RouteIcon,
} from "lucide-react";
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

/* Reveal on scroll */
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add("lp-in");
            io.disconnect();
          }
        });
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`lp-reveal ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* Animated counter */
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / 1400);
        setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return (
    <span ref={ref}>
      {val.toLocaleString("it-IT")}
      {suffix}
    </span>
  );
}

const MARQUEE_ITEMS = [
  { icon: Bike, label: "20 centesimi al km in bici" },
  { icon: Footprints, label: "6 centesimi al km a piedi" },
  { icon: ShieldCheck, label: "Passaporto bici antifurto" },
  { icon: Gift, label: "Premi da aziende e Comuni" },
  { icon: MapPin, label: "Fontanelle e rastrelliere in mappa" },
  { icon: Trophy, label: "Sfide, coppe e classifiche" },
  { icon: Wallet, label: "Riscatto in denaro o servizi" },
];

function WelcomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const onPointerMove = (e: React.PointerEvent) => {
    const rect = heroRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x, y });
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      {/* ===== Sfondo animato verde ===== */}
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <div className="lp-blob left-[-10%] top-[-15%] size-[46rem] bg-cicla opacity-25" />
        <div className="lp-blob right-[-12%] top-[20%] size-[38rem] bg-info opacity-15" style={{ animationDelay: "-5s" }} />
        <div className="lp-blob bottom-[-20%] left-[25%] size-[42rem] bg-cicla opacity-15" style={{ animationDelay: "-9s" }} />
        {/* Griglia sottile */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
      </div>

      {/* ===== Header ===== */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 pt-5 sm:px-8">
        <CiclaLogo size="md" />
        <div className="flex items-center gap-3">
          <Link
            to="/auth"
            search={{ mode: "login" }}
            className="hidden rounded-full app-glass px-5 py-2 text-xs font-bold uppercase tracking-wider text-foreground/80 transition-transform hover:scale-105 sm:inline-block"
          >
            Accedi
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="rounded-full bg-cicla px-5 py-2 text-xs font-bold uppercase tracking-wider text-cicla-foreground shadow-cicla transition-transform hover:scale-105"
          >
            Inizia ora
          </Link>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section
        ref={heroRef}
        onPointerMove={onPointerMove}
        className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-10 px-5 pb-16 pt-10 sm:px-8 lg:min-h-[calc(100vh-88px)] lg:grid-cols-[1.1fr_1fr] lg:gap-6 lg:pb-0 lg:pt-0"
      >
        <div className="lp-reveal lp-in">
          <span className="inline-flex items-center gap-2 rounded-full bg-cicla/15 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-cicla ring-1 ring-cicla/30">
            <span className="size-1.5 animate-pulse rounded-full bg-cicla" /> Mobilità che premia
          </span>
          <h1 className="mt-5 font-display text-[40px] font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
            Muoviti green.
            <br />
            <span className="relative inline-block bg-gradient-to-r from-cicla via-cicla to-info bg-clip-text text-transparent">
              Vinci premi.
              <Sparkles className="absolute -right-8 -top-3 hidden size-6 text-cicla lp-float sm:block" />
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Cicla Qui traccia i tuoi spostamenti sostenibili, protegge la tua bici dai furti
            e trasforma i chilometri in <strong className="text-foreground">punti</strong> riscattabili
            con i premi messi a disposizione dalla tua azienda o dal tuo Comune.
          </p>

          <div className="mt-8 grid gap-3 sm:max-w-md">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="group relative flex h-16 items-center justify-between overflow-hidden rounded-2xl bg-cicla px-5 text-cicla-foreground shadow-cicla transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="pointer-events-none absolute inset-y-0 w-1/3 bg-cicla-foreground/15" style={{ animation: "lp-shine 3.2s ease-in-out infinite" }} />
              <span className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-cicla-foreground/15">
                  <Bike size={20} />
                </span>
                <span className="text-left font-display text-base font-bold leading-tight">
                  Sono un dipendente
                  <br />
                  <span className="text-[11px] font-medium opacity-80">o un cittadino con codice</span>
                </span>
              </span>
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              to="/azienda/auth"
              search={{ mode: "signup" }}
              className="group flex h-16 items-center justify-between rounded-2xl app-glass-strong px-5 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-foreground/10">
                  <Landmark size={20} />
                </span>
                <span className="text-left font-display text-base font-bold leading-tight">
                  Registra azienda
                  <br />
                  <span className="text-[11px] font-medium text-muted-foreground">o Comune</span>
                </span>
              </span>
              <ArrowRight size={18} className="text-muted-foreground transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* ===== Visual hero: anelli + bici + chip fluttuanti ===== */}
        <div className="relative mx-auto hidden aspect-square w-full max-w-[520px] select-none lg:block" aria-hidden>
          {/* Anelli pulsanti */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute inset-[12%] rounded-full border border-cicla/30"
              style={{ animation: `lp-ring-pulse 4s ease-out infinite`, animationDelay: `${i * 1.3}s` }}
            />
          ))}
          {/* Anello tratteggiato rotante */}
          <div
            className="absolute inset-[6%] rounded-full border border-dashed border-cicla/40"
            style={{
              animation: "lp-spin-slow 40s linear infinite",
              transform: `translate(${tilt.x * 10}px, ${tilt.y * 10}px)`,
            }}
          />
          {/* Strada animata */}
          <svg viewBox="0 0 400 400" className="absolute inset-0 size-full opacity-60" style={{ transform: `translate(${tilt.x * 6}px, ${tilt.y * 6}px)` }}>
            <path
              d="M 40 300 C 120 180, 200 340, 280 200 S 360 120, 380 90"
              fill="none"
              stroke="var(--color-cicla)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="14 20"
              style={{ animation: "lp-road 3s linear infinite" }}
              opacity="0.6"
            />
          </svg>
          {/* Disco centrale con bici */}
          <div
            className="absolute inset-[26%] grid place-items-center rounded-full app-glass-strong shadow-cicla"
            style={{ transform: `translate(${tilt.x * 18}px, ${tilt.y * 18}px)` }}
          >
            <div className="grid size-28 place-items-center rounded-full bg-gradient-to-br from-cicla to-info text-cicla-foreground shadow-cicla lp-float">
              <Bike size={52} strokeWidth={1.6} />
            </div>
          </div>
          {/* Chip fluttuanti */}
          <FloatChip className="left-[2%] top-[16%]" tilt={tilt} depth={30} delay="-1s" icon={<Zap size={14} className="text-cicla" />} label="+10 punti" />
          <FloatChip className="right-[0%] top-[34%]" tilt={tilt} depth={-24} delay="-2.4s" icon={<Leaf size={14} className="text-cicla" />} label="CO₂ risparmiata" />
          <FloatChip className="bottom-[18%] left-[10%]" tilt={tilt} depth={26} delay="-3.4s" icon={<RouteIcon size={14} className="text-info" />} label="4,2 km in bici" />
          <FloatChip className="bottom-[8%] right-[14%]" tilt={tilt} depth={-30} delay="-4.2s" icon={<QrCode size={14} className="text-info" />} label="Passaporto attivo" />
        </div>
      </section>

      {/* ===== Marquee ===== */}
      <div className="relative z-10 border-y border-foreground/10 bg-foreground/[0.03] py-4 backdrop-blur-sm">
        <div className="lp-marquee-track gap-10 pr-10">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="flex shrink-0 items-center gap-2.5 text-sm font-semibold text-muted-foreground">
              <item.icon size={16} className="text-cicla" />
              {item.label}
              <span className="ml-6 size-1 rounded-full bg-cicla/50" />
            </span>
          ))}
        </div>
      </div>

      {/* ===== Statistiche ===== */}
      <section className="relative z-10 mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {[
            { icon: Bike, value: 20, suffix: " cent", label: "per ogni km in bici" },
            { icon: Footprints, value: 6, suffix: " cent", label: "per ogni km a piedi" },
            { icon: Gift, value: 500, suffix: " pt", label: "soglia per riscattare i premi" },
            { icon: Leaf, value: 100, suffix: "%", label: "green, zero emissioni" },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 100}>
              <div className="group rounded-3xl app-glass p-5 text-center transition-transform duration-300 hover:-translate-y-1.5 sm:p-6">
                <s.icon size={22} className="mx-auto text-cicla transition-transform duration-300 group-hover:scale-110" />
                <div className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
                  <Counter to={s.value} suffix={s.suffix} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== Funzionalità ===== */}
      <section className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-20 sm:px-8">
        <Reveal>
          <h2 className="text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Tutto quello che serve per <span className="bg-gradient-to-r from-cicla to-info bg-clip-text text-transparent">pedalare premiato</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground sm:text-base">
            Un'unica app per muoverti, guadagnare punti e proteggere la tua bici.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<MapPin size={18} />}
            title="Mappa GPS intelligente"
            desc="Rileva in automatico il mezzo: bici, piedi o auto. Con fontanelle, rastrelliere e meccanici sempre a portata di mano."
            delay={0}
          />
          <FeatureCard
            icon={<Gift size={18} />}
            title="Punti = premi veri"
            desc="Voucher, denaro e servizi Doctorbike messi a disposizione dalla tua azienda o dal tuo Comune."
            delay={100}
          />
          <FeatureCard
            icon={<ShieldCheck size={18} />}
            title="Passaporto bici"
            desc="Registra la tua bici con QR e numero di telaio: riconoscibile e tracciabile in caso di furto."
            delay={200}
          />
          <FeatureCard
            icon={<Building2 size={18} />}
            title="Aziende & Comuni"
            desc="Dashboard dedicata, sfide a squadre, classifiche e premi per motivare dipendenti e cittadini."
            delay={300}
          />
        </div>
      </section>

      {/* ===== CTA finale ===== */}
      <section className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-16 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-cicla to-info p-8 text-center text-cicla-foreground shadow-cicla sm:p-14">
            <div className="pointer-events-none absolute -left-10 -top-10 size-52 rounded-full bg-cicla-foreground/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-12 -right-8 size-64 rounded-full bg-cicla-foreground/10 blur-2xl" />
            <Bike size={40} className="mx-auto lp-float" />
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Pronto a trasformare ogni km in un premio?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm opacity-90">
              Scarica l'app, inserisci il codice della tua azienda o del tuo Comune e inizia a pedalare.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="rounded-full bg-background px-8 py-3 text-sm font-bold text-foreground transition-transform hover:scale-105"
              >
                Crea il tuo account
              </Link>
              <Link
                to="/azienda/auth"
                search={{ mode: "signup" }}
                className="rounded-full bg-cicla-foreground/15 px-8 py-3 text-sm font-bold ring-1 ring-cicla-foreground/30 transition-transform hover:scale-105"
              >
                Registra la tua azienda
              </Link>
            </div>
          </div>
        </Reveal>

        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          Hai già un account?{" "}
          <Link to="/auth" search={{ mode: "login" }} className="font-bold text-foreground underline-offset-2 hover:underline">
            Accedi
          </Link>
          {" · "}
          <Link to="/legal/privacy" className="underline-offset-2 hover:underline">Privacy</Link>
          {" · "}
          <Link to="/legal/terms" className="underline-offset-2 hover:underline">Termini</Link>
        </p>
      </section>
    </div>
  );
}

function FloatChip({
  className, icon, label, tilt, depth, delay,
}: {
  className: string;
  icon: React.ReactNode;
  label: string;
  tilt: { x: number; y: number };
  depth: number;
  delay: string;
}) {
  return (
    <div
      className={`absolute z-10 ${className}`}
      style={{ transform: `translate(${tilt.x * depth}px, ${tilt.y * depth}px)` }}
    >
      <div className="flex items-center gap-2 rounded-2xl app-glass-strong px-3.5 py-2 text-xs font-bold shadow-cicla lp-float" style={{ animationDelay: delay }}>
        {icon}
        {label}
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc, delay }: { icon: React.ReactNode; title: string; desc: string; delay: number }) {
  return (
    <Reveal delay={delay}>
      <div className="group relative h-full overflow-hidden rounded-3xl app-glass p-5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-cicla sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-cicla/10 blur-2xl transition-opacity duration-300 group-hover:bg-cicla/20" />
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cicla/15 text-cicla ring-1 ring-cicla/25 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
          {icon}
        </div>
        <div className="mt-4 font-display text-base font-bold leading-tight">{title}</div>
        <div className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">{desc}</div>
      </div>
    </Reveal>
  );
}
