import { Link, useRouterState } from "@tanstack/react-router";
import { Map, Bike, Coins, Trophy, User } from "lucide-react";
import { useEffect, useRef } from "react";

const items = [
  { to: "/app", label: "Mappa", icon: Map, exact: true },
  { to: "/app/bici", label: "Bici", icon: Bike, exact: false },
  { to: "/app/sfide", label: "Sfide", icon: Trophy, exact: false },
  { to: "/app/punti", label: "Punti", icon: Coins, exact: false },
  { to: "/app/profilo", label: "Profilo", icon: User, exact: false },
] as const;

export function BottomNav() {
  // Profiler navigazione: misura il tempo dal click al pathname change.
  const pendingRef = useRef<{ to: string; t: number } | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    const p = pendingRef.current;
    if (p && (pathname === p.to || pathname.startsWith(p.to + "/"))) {
      const ms = Math.round(performance.now() - p.t);
      // eslint-disable-next-line no-console
      console.info(`[nav] ${p.to} · ${ms}ms`);
      pendingRef.current = null;
    }
  }, [pathname]);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[1100] px-4"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 10px)" }}
    >
      <div className="relative mx-auto grid h-[62px] w-full max-w-md grid-cols-5 items-center rounded-[26px] app-glass-strong px-1 shadow-2xl">
        {items.map((it) => (
          <NavItem
            key={it.to}
            {...it}
            onNavStart={(to) => {
              pendingRef.current = { to, t: performance.now() };
            }}
          />
        ))}
      </div>
    </nav>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  exact,
  onNavStart,
}: {
  to: string;
  label: string;
  icon: typeof Map;
  exact: boolean;
  onNavStart: (to: string) => void;
}) {
  return (
    <Link
      to={to}
      // "render": scarica il chunk della sezione appena la nav è visibile,
      // così il click non paga il round-trip di rete su mobile.
      preload="render"
      activeOptions={{ exact }}
      onClick={() => onNavStart(to)}
      className="group flex min-w-0 flex-col items-center gap-1 px-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors data-[status=active]:text-cicla"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-2xl transition-colors group-data-[status=active]:bg-cicla group-data-[status=active]:text-cicla-foreground group-data-[status=active]:shadow-[0_8px_20px_-6px_var(--cicla)]">
        <Icon size={19} strokeWidth={2.2} />
      </span>
      <span className="w-full truncate text-center font-display text-[9px]">{label}</span>
    </Link>
  );
}
