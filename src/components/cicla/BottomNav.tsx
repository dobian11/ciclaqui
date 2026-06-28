import { Link } from "@tanstack/react-router";
import { Map, Bike, Coins, Trophy, User } from "lucide-react";

const items = [
  { to: "/app", label: "Mappa", icon: Map, exact: true },
  { to: "/app/bici", label: "Bici", icon: Bike, exact: false },
  { to: "/app/sfide", label: "Sfide", icon: Trophy, exact: false },
  { to: "/app/punti", label: "Punti", icon: Coins, exact: false },
  { to: "/app/profilo", label: "Profilo", icon: User, exact: false },
] as const;

export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[1100] px-4 pb-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
    >
      <div className="relative mx-auto flex h-[62px] max-w-md items-center justify-around rounded-[26px] app-glass-strong px-2 shadow-2xl">
        {items.map((it) => (
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
