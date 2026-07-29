import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { BottomNav } from "@/components/cicla/BottomNav";
import { PermissionsOnboarding } from "@/components/cicla/PermissionsOnboarding";
import { prefetchGoogleMaps } from "@/lib/google-maps-loader";

export const Route = createFileRoute("/_authenticated/app")({
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
