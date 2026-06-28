import { Link } from "@tanstack/react-router";
import { Map, Bike, Coins, User, AlertTriangle } from "lucide-react";

const SOS_URL = "https://www.db360app.it";

const left = [
  { to: "/app", label: "Mappa", icon: Map, exact: true },
  { to: "/app/bici", label: "Bici", icon: Bike, exact: false },
] as const;

const right = [
  { to: "/app/punti", label: "Punti", icon: Coins, exact: false },
  { to: "/app/profilo", label: "Profilo", icon: User, exact: false },
] as const;

export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[1100] px-4 pb-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
    >
      <div className="relative mx-auto flex h-[68px] max-w-md items-center justify-around rounded-[28px] app-glass-strong px-3 shadow-2xl">
        {left.map((it) => (
          <NavItem key={it.to} {...it} />
        ))}

        {/* FAB SOS centrale */}
        <a
          href={SOS_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="SOS"
          className="absolute left-1/2 -top-7 -translate-x-1/2 grid size-16 place-items-center rounded-full bg-destructive text-white shadow-[0_12px_28px_-6px_rgba(220,38,38,0.6)] ring-4 ring-background transition-transform active:scale-95"
        >
          <AlertTriangle size={24} strokeWidth={2.6} />
          <span className="absolute -bottom-5 text-[10px] font-bold tracking-widest text-destructive">
            SOS
          </span>
        </a>

        {/* spacer for FAB */}
        <div className="w-14" aria-hidden />

        {right.map((it) => (
          <NavItem key={it.to} {...it} />
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
}: {
  to: string;
  label: string;
  icon: typeof Map;
  exact: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className="group flex flex-col items-center gap-1 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors data-[status=active]:text-cicla"
    >
      <span className="grid size-10 place-items-center rounded-2xl transition-colors group-data-[status=active]:bg-cicla group-data-[status=active]:text-cicla-foreground group-data-[status=active]:shadow-[0_8px_20px_-6px_var(--cicla)]">
        <Icon size={20} strokeWidth={2.2} />
      </span>
      <span className="font-display">{label}</span>
    </Link>
  );
}
