import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CiclaLogo } from "@/components/cicla/CiclaLogo";
import { Building2, LogOut, Shield, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/profilo")({
  component: ProfiloPage,
});

function ProfiloPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  const profileQ = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("not signed in");
      const [{ data: profile }, { data: roles }, { data: company }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, weight_kg, company_id, avatar_url")
          .eq("id", user.user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.user.id),
        (async () => {
          const { data: prof } = await supabase
            .from("profiles")
            .select("company_id")
            .eq("id", user.user!.id)
            .maybeSingle();
          if (!prof?.company_id) return { data: null };
          return supabase
            .from("companies")
            .select("name, code")
            .eq("id", prof.company_id)
            .maybeSingle();
        })(),
      ]);
      return {
        email: user.user.email ?? "",
        profile,
        roles: roles?.map((r) => r.role) ?? [],
        company,
      };
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Arrivederci!");
    await router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  const isManager = profileQ.data?.roles.includes("company_manager");
  const isAdmin = profileQ.data?.roles.includes("admin");

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-md px-5 py-6">
        <CiclaLogo size="md" />

        <Card className="mt-6 p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-full bg-cicla/10 text-cicla">
              <UserIcon size={22} />
            </div>
            <div className="min-w-0">
              <div className="truncate font-display text-lg font-semibold">
                {profileQ.data?.profile?.full_name ?? "—"}
              </div>
              <div className="truncate text-sm text-muted-foreground">{profileQ.data?.email}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {profileQ.data?.roles.map((r) => (
              <span
                key={r}
                className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-secondary-foreground"
              >
                {r}
              </span>
            ))}
          </div>
        </Card>

        {profileQ.data?.company && (
          <Card className="mt-4 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Building2 size={14} /> Azienda di appartenenza
            </div>
            <div className="mt-1 font-display text-lg font-semibold">
              {profileQ.data.company.name}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Codice: <span className="font-mono">{profileQ.data.company.code}</span>
            </div>
          </Card>
        )}

        {(isManager || isAdmin) && (
          <Card className="mt-4 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Shield size={14} /> Aree riservate
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {isManager && (
                <Button variant="outline" disabled className="justify-start">
                  <Building2 size={16} className="mr-2" /> Dashboard azienda (Sprint 5)
                </Button>
              )}
              {isAdmin && (
                <Button variant="outline" disabled className="justify-start">
                  <Shield size={16} className="mr-2" /> Pannello admin (Sprint 5)
                </Button>
              )}
            </div>
          </Card>
        )}

        <Button onClick={signOut} variant="outline" className="mt-6 w-full">
          <LogOut size={16} className="mr-2" /> Esci
        </Button>

        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          Cicla Qui · MVP Sprint 1
        </p>
      </div>
    </div>
  );
}
