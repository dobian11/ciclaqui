import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Prima prova a leggere la sessione dallo storage (evita blocchi se il refresh
    // di rete è lento o fallisce). Se non c'è sessione, redirect a /auth.
    let user = null as Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"];
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        // Sessione presente in storage: valida via getUser ma non bloccare troppo.
        const userPromise = supabase.auth.getUser();
        const timeout = new Promise<{ data: { user: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { user: sessionData.session!.user } as never }), 2500),
        );
        const { data } = (await Promise.race([userPromise, timeout])) as Awaited<
          ReturnType<typeof supabase.auth.getUser>
        >;
        user = data.user ?? sessionData.session.user ?? null;
      }
    } catch {
      user = null;
    }

    if (!user) {
      throw redirect({ to: "/auth", search: { mode: "login", redirect: location.href } as never });
    }
    return { user };
  },
  component: () => <Outlet />,
});
