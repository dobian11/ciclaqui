/**
 * Verifica che l'utente sia manager e titolare di un ente, restituendo il suo company_id.
 * Usato dai server function dell'area ente (premi, coppe, badge).
 */
export async function assertManagerCompany(
  supabase: any,
  userId: string,
): Promise<string> {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const isManager = (roles ?? []).some((r: { role: string }) => r.role === "company_manager");
  if (!isManager) throw new Error("Riservato ai manager dell'ente");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.company_id) throw new Error("Nessun ente associato al tuo profilo");

  const { data: ownsCompany } = await supabase.rpc("owns_company", {
    _company_id: profile.company_id,
  });
  if (!ownsCompany) throw new Error("Accesso riservato al titolare dell'ente");
  return profile.company_id as string;
}

export function monthRange(monthIso?: string) {
  const base = monthIso ? new Date(`${monthIso}-01T00:00:00.000Z`) : new Date();
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}
