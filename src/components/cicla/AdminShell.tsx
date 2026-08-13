import type { ComponentType, ReactNode } from "react";
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

export type AdminTab = {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /** Contatore mostrato accanto all'etichetta (es. elementi in attesa). */
  count?: number;
};

/**
 * Layout del pannello admin: sidebar fissa su desktop/tablet, header sticky con
 * navigazione a tab scorrevole su mobile.
 */
export function AdminShell({
  title,
  subtitle,
  unread = 0,
  actions,
  tabs,
  activeTab,
  onTabChange,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  unread?: number;
  actions?: ReactNode;
  tabs?: AdminTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
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
          {/* Header sticky (titolo + tab) */}
          <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
            <div className="mx-auto w-full max-w-[1600px] px-4 md:px-8">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="md:hidden">
                    <CiclaLogo size="sm" />
                  </span>
                  <div className="min-w-0">
                    <h1 className="truncate text-lg font-bold tracking-tight md:text-2xl lg:text-3xl">
                      {title}
                    </h1>
                    {subtitle && (
                      <div className="mt-0.5 hidden truncate text-sm text-muted-foreground md:block">
                        {subtitle}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {unread > 0 && (
                    <Badge variant="secondary" className="bg-warning/15 text-warning">
                      <Bell className="mr-1 size-3" /> {unread}
                    </Badge>
                  )}
                  {actions}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 md:hidden"
                    onClick={signOut}
                  >
                    <LogOut className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Tab di sezione */}
              {tabs && tabs.length > 0 && (
                <nav
                  role="tablist"
                  aria-label="Sezioni"
                  className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
                >
                  {tabs.map((t) => {
                    const active = t.id === activeTab;
                    return (
                      <button
                        key={t.id}
                        role="tab"
                        aria-selected={active}
                        onClick={() => onTabChange?.(t.id)}
                        className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition md:text-[13px] ${
                          active
                            ? "bg-cicla/15 text-cicla"
                            : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {t.icon && <t.icon className="size-3.5 shrink-0" />}
                        {t.label}
                        {typeof t.count === "number" && t.count > 0 && (
                          <span
                            className={`rounded-full px-1.5 text-[10px] ${
                              active ? "bg-cicla/20" : "bg-background/70"
                            }`}
                          >
                            {t.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              )}

              {/* Navigazione di rotta su mobile */}
              <nav className="flex gap-1 pb-2 md:hidden">
                {NAV.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    activeOptions={{ exact: item.exact }}
                    activeProps={{ className: "bg-cicla/10 text-cicla" }}
                    inactiveProps={{ className: "text-muted-foreground bg-secondary/40" }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition"
                  >
                    <item.icon className="size-3.5" />
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1600px] px-4 py-6 pb-16 md:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
