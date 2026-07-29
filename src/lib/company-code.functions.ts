import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ code: z.string().trim().min(3).max(20) });

export type CompanyCodeCheck = {
  ok: boolean;
  reason?: "not_found" | "not_approved";
  name?: string;
  kind?: "company" | "municipality";
};

/**
 * Verifica pubblica del codice ente in fase di registrazione:
 * serve a bloccare subito i codici inesistenti o non ancora approvati,
 * così l'utente non finisce in una seconda schermata dopo la conferma email.
 */
export const checkCompanyCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }): Promise<CompanyCodeCheck> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("name, kind, status")
      .eq("code", data.code.trim().toUpperCase())
      .maybeSingle();

    if (!company) return { ok: false, reason: "not_found" };
    if (company.status !== "approved") return { ok: false, reason: "not_approved", name: company.name };
    return { ok: true, name: company.name, kind: company.kind as "company" | "municipality" };
  });
