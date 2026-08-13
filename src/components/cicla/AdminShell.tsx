import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CiclaLogo } from "@/components/cicla/CiclaLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, ShieldCheck, LogOut, Shield, Bell } from "lucide-react";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/verifiche", label: "Verifiche enti", icon: ShieldCheck, exact: false },
] as const;

/**
 * Layout del pannello admin: sidebar fissa e larghezza piena su desktop/tablet
 * orizzontale, barra di navigazione compatta su mobile.
 */
export function AdminShell({
  title,
  subtitle,
  unread = 0,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  unread?: number;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth" as never, replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/30 to-background">
      <div className="flex min-h-screen w-full">
        {/* Sidebar desktop/tablet */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border/60 bg-card/40 px-4 py-6 backdrop-blur md:flex">
          <CiclaLogo size="md" />
          <Badge variant="secondary" className="mt-4 w-fit bg-destructive/10 text-destructive">
            <Shield className="mr-1 size-3" /> Admin
          </Badge>

          <nav className="mt-6 flex flex-1 flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact }}
                activeProps={{ className: "bg-cicla/10 text-cicla" }}
                inactiveProps={{ className: "text-muted-foreground hover:bg-secondary/60" }}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition"
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <Button variant="outline" size="sm" className="mt-4 w-full gap-2" onClick={signOut}>
            <LogOut className="size-4" /> Esci
          </Button>
        </aside>

        {/* Contenuto */}
        <div className="min-w-0 flex-1">
          {/* Header mobile */}
          <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur md:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <CiclaLogo size="sm" />
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <Badge variant="secondary" className="bg-warning/15 text-warning">
                    <Bell className="mr-1 size-3" /> {unread}
                  </Badge>
                )}
                <Button variant="outline" size="sm" className="h-8 px-2" onClick={signOut}>
                  <LogOut className="size-4" />
                </Button>
              </div>
            </div>
            <nav className="flex gap-1 px-3 pb-2">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.exact }}
                  activeProps={{ className: "bg-cicla/10 text-cicla" }}
                  inactiveProps={{ className: "text-muted-foreground bg-secondary/50" }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-semibold transition"
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>

          <main className="mx-auto w-full max-w-[1600px] px-4 py-6 pb-16 md:px-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{title}</h1>
                {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
              </div>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <Badge
                    variant="secondary"
                    className="hidden bg-warning/15 text-warning md:inline-flex"
                  >
                    <Bell className="mr-1 size-3" /> {unread}
                  </Badge>
                )}
                {actions}
              </div>
            </div>

            <div className="mt-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
