import type { ComponentType, ReactNode } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CiclaLogo } from "@/components/cicla/CiclaLogo";
import { NotificationsBell } from "@/components/cicla/NotificationsBell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Landmark, LogOut } from "lucide-react";

export type CompanySection = {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  count?: number;
};

/**
 * Layout a tutto schermo dell'area ente: sidebar fissa su desktop/tablet,
 * header sticky con tab scorrevoli su mobile. Stessa struttura del pannello admin.
 */
export function CompanyShell({
  title,
  subtitle,
  isMuni,
  sections,
  activeSection,
  onSectionChange,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  isMuni: boolean;
  sections: CompanySection[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/" as never, replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/30 to-background">
      <div className="flex min-h-screen w-full">
        {/* Sidebar desktop/tablet */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border/60 bg-card/40 px-4 py-6 backdrop-blur md:flex">
          <CiclaLogo size="md" />
          <Badge variant="secondary" className="mt-4 w-fit bg-cicla/10 text-cicla">
            {isMuni ? <Landmark className="mr-1 size-3" /> : <Building2 className="mr-1 size-3" />}
            {isMuni ? "Comune" : "Azienda"}
          </Badge>

          <nav className="mt-6 flex flex-1 flex-col gap-1" aria-label="Sezioni ente">
            {sections.map((s) => {
              const active = s.id === activeSection;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => onSectionChange(s.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                    active ? "bg-cicla/10 text-cicla" : "text-muted-foreground hover:bg-secondary/60"
                  }`}
                >
                  {s.icon && <s.icon className="size-4" />}
                  <span className="flex-1 truncate">{s.label}</span>
                  {s.count ? (
                    <span className="rounded-full bg-secondary px-1.5 text-[10px] font-bold tabular-nums">
                      {s.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <Button variant="outline" size="sm" className="mt-4 w-full gap-2" onClick={signOut}>
            <LogOut className="size-4" /> Esci
          </Button>
        </aside>

        {/* Contenuto */}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
            <div className="mx-auto w-full max-w-[1600px] px-4 md:px-8">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="md:hidden">
                    <CiclaLogo size="sm" showTagline={false} />
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
                  <NotificationsBell />
                  {actions}
                  <Button variant="outline" size="sm" className="h-8 px-2 md:hidden" onClick={signOut}>
                    <LogOut className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Tab mobile */}
              <nav
                role="tablist"
                aria-label="Sezioni ente"
                className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
              >
                {sections.map((s) => {
                  const active = s.id === activeSection;
                  return (
                    <button
                      key={s.id}
                      role="tab"
                      aria-selected={active}
                      onClick={() => onSectionChange(s.id)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                        active
                          ? "bg-cicla text-cicla-foreground"
                          : "border border-border bg-background text-muted-foreground"
                      }`}
                    >
                      {s.icon && <s.icon className="size-3.5" />}
                      {s.label}
                      {s.count ? <span className="tabular-nums">({s.count})</span> : null}
                    </button>
                  );
                })}
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1600px] px-4 py-5 md:px-8 md:py-7">{children}</main>
        </div>
      </div>
    </div>
  );
}
