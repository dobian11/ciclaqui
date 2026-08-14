import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { BottomNav } from "@/components/cicla/BottomNav";
import { PermissionsOnboarding } from "@/components/cicla/PermissionsOnboarding";
import { prefetchGoogleMaps } from "@/lib/google-maps-loader";
import { fetchRoleContext } from "@/lib/auth-redirect";
import { useStableViewportHeight } from "@/hooks/use-stable-viewport";
import { usePush, isNativeApp } from "@/hooks/use-push";
import { usePushListeners } from "@/hooks/use-push-listeners";


export const Route = createFileRoute("/_authenticated/app")({
  beforeLoad: async () => {
    // Un admin non deve restare nell'area ciclista: verifica a ogni ingresso
    // nel layout (nessun flag globale, che verrebbe condiviso tra utenti/sessioni).
    const ctx = await fetchRoleContext();
    if (ctx?.isAdmin) throw redirect({ to: "/admin" as never });
  },
  component: AppLayout,
});



function AppLayout() {
  // Altezza stabile: la tastiera non deve rimpicciolire mappa e layout.
  useStableViewportHeight();
  usePushListeners();
  const { register } = usePush();

  // Scalda l'SDK mappe in idle: quando l'utente arriva sulla scheda Mappa
  // (o ci torna da un'altra tab) lo script è già in cache.
  useEffect(() => {
    prefetchGoogleMaps();
  }, []);

  // Su app nativa: se il permesso è già concesso, rinfresca il token FCM
  // (rotazione token / reinstallazione) senza mostrare prompt.
  useEffect(() => {
    if (!isNativeApp()) return;
    void register({ silent: true });
  }, [register]);



  return (
    <div
      className="fixed inset-x-0 top-0 flex flex-col"
      style={{ height: "var(--app-shell-h, 100dvh)" }}
    >
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
