import { supabase } from "@/integrations/supabase/client";

export type RoleContext = {
  isAdmin: boolean;
  isManager: boolean;
  hasCompany: boolean;
};

/**
 * Funzione pura: dato il contesto ruoli, restituisce la destinazione post-login.
 * - admin → area amministrazione
 * - company_manager senza azienda → onboarding ente
 * - company_manager con azienda → dashboard ente
 * - altrimenti (ciclista/cittadino) → app
 */
export function resolveRedirect(ctx: RoleContext): string {
  if (ctx.isAdmin) return "/admin";
  if (ctx.isManager) return ctx.hasCompany ? "/azienda" : "/azienda/onboarding";
  return "/app";
}

/**
 * Determina dove portare l'utente dopo il login in base al ruolo.
 */
export async function getPostLoginRedirect(): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return "/auth";

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);

  const isManager = roles?.some((r) => r.role === "company_manager") ?? false;
  const isAdmin = roles?.some((r) => r.role === "admin") ?? false;

  let hasCompany = false;
  if (isManager && !isAdmin) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userData.user.id)
      .maybeSingle();
    hasCompany = !!profile?.company_id;
  }

  return resolveRedirect({ isAdmin, isManager, hasCompany });
}
