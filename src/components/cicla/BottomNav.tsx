import { Link } from "@tanstack/react-router";
import { Map, Bike, Coins, User } from "lucide-react";

const items = [
  { to: "/app", label: "Mappa", icon: Map, exact: true },
  { to: "/app/bici", label: "Bici", icon: Bike, exact: false },
  { to: "/app/punti", label: "Punti", icon: Coins, exact: false },
  { to: "/app/profilo", label: "Profilo", icon: User, exact: false },
] as const;

export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[1100] border-t border-border/60 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                activeOptions={{ exact: it.exact }}
                className="group flex flex-col items-center gap-0.5 px-2 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors data-[status=active]:text-cicla"
              >
                <Icon size={22} strokeWidth={2.2} />
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
