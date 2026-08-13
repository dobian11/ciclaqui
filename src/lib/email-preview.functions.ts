import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const schema = z.object({
  company_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().max(500).optional().nullable(),
  app_url: z.string().url().optional(),
});

/**
 * Renderizza l'anteprima HTML dell'email "Esito verifica ente" senza inviarla.
 * Solo admin. Usa gli stessi dati che verranno usati dall'invio reale.
 */
export const renderDecisionEmailPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: admin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!admin) throw new Error("Solo gli admin possono vedere l'anteprima");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, name, kind, code, contact_email")
      .eq("id", data.company_id)
      .maybeSingle();
    if (companyError) throw new Error(`Lettura ente fallita: ${companyError.message}`);
    if (!company) throw new Error("Ente non trovato");

    const approved = data.decision === "approved";
    const decidedAt = new Date().toISOString();
    const templateData = {
      companyName: company.name,
      kind: company.kind,
      decision: data.decision,
      decidedAt,
      reason: approved ? null : (data.reason ?? null),
      code: approved ? company.code : null,
      appUrl: data.app_url ?? "https://ciclaqui.it",
    };

    const [{ render }, { template }] = await Promise.all([
      import("@react-email/render"),
      import("@/lib/email-templates/company-decision"),
    ]);

    const Component = template.component as React.ComponentType<Record<string, unknown>>;
    const { createElement } = await import("react");
    const html = await render(createElement(Component, templateData));
    const subject =
      typeof template.subject === "function"
        ? template.subject(templateData as Record<string, unknown>)
        : template.subject;

    return {
      html,
      subject,
      recipient: company.contact_email,
      companyName: company.name,
      decidedAt,
      reason: templateData.reason,
      nextStep: approved
        ? "Attivare l'abbonamento dal pannello ente per rendere operativo il codice."
        : "Aggiornare i dati e i documenti, poi reinviare la richiesta di revisione (24–48h).",
    };
  });
