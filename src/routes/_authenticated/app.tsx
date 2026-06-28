import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BottomNav } from "@/components/cicla/BottomNav";
import { PermissionsOnboarding } from "@/components/cicla/PermissionsOnboarding";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
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
