import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // Auth gate temporaneamente disattivato per anteprima
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    return { user: data.user ?? null };
  },
  component: () => <Outlet />,
});
// Suppress unused import warning while gate is disabled
void redirect;
