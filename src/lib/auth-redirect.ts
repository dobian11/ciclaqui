import { supabase } from "@/integrations/supabase/client";

/**
 * Determina dove portare l'utente dopo il login in base al ruolo.
 * - company_manager senza azienda → onboarding azienda
 * - company_manager con azienda → dashboard azienda
 * - user → app utente
 */
export async function getPostLoginRedirect(): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return "/auth";

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);

  const isManager = roles?.some((r) => r.role === "company_manager");
  const isAdmin = roles?.some((r) => r.role === "admin");

  if (isAdmin) return "/azienda";

  if (isManager) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!profile?.company_id) return "/azienda/onboarding";
    return "/azienda";
  }

  // Utente semplice: se non è ancora collegato a un ente o mancano i dati
  // anagrafici (tipico dopo il login con Google) chiediamo di completare.
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, full_name")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!profile?.company_id || !profile.full_name?.trim()) return "/collega";

  return "/app";
}
