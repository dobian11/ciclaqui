import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { BottomNav } from "@/components/cicla/BottomNav";
import { PermissionsOnboarding } from "@/components/cicla/PermissionsOnboarding";
import { prefetchGoogleMaps } from "@/lib/google-maps-loader";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app")({
  // Chi entra con Google (o con un account incompleto) deve prima completare
  // nome + codice ente: senza questi dati l'app non può assegnare punti.
  beforeLoad: async ({ context }) => {
    const userId = (context as { user?: { id?: string } }).user?.id;
    if (!userId) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, full_name")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.company_id || !profile.full_name?.trim()) {
      throw redirect({ to: "/collega" });
    }
  },
  component: AppLayout,
});


function AppLayout() {
  // Scalda l'SDK mappe in idle: quando l'utente arriva sulla scheda Mappa
  // (o ci torna da un'altra tab) lo script è già in cache.
  useEffect(() => {
    prefetchGoogleMaps();
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col">
      <main
        className="relative flex-1 overflow-hidden"
        style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0))" }}
      >
        <Outlet />
      </main>
      <BottomNav />
      <PermissionsOnboarding />
    </div>
  );
}
