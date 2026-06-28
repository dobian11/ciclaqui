import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Generates an "Add to Google Wallet" save link for a bike passport.
 *
 * Requires the following secrets (configurable later via add_secret):
 *  - GOOGLE_WALLET_ISSUER_ID
 *  - GOOGLE_WALLET_CLASS_ID
 *  - GOOGLE_WALLET_SERVICE_ACCOUNT_JSON (full JSON, used to sign the JWT)
 *
 * Until those are configured, returns { configured: false } so the UI can
 * show a graceful "non configurato" state instead of crashing.
 */
export const getGoogleWalletLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bike_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: bike, error } = await context.supabase
      .from("bikes")
      .select("id, marca, modello, colore, frame_number, owner_id")
      .eq("id", data.bike_id)
      .single();
    if (error || !bike) throw new Error("Bici non trovata");
    if (bike.owner_id !== context.userId) throw new Error("Non autorizzato");

    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
    const classId = process.env.GOOGLE_WALLET_CLASS_ID;
    const saJson = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON;
    if (!issuerId || !classId || !saJson) {
      return { configured: false as const };
    }

    // Lazy import to keep the worker bundle small when not configured
    const { SignJWT, importPKCS8 } = await import("jose");
    const sa = JSON.parse(saJson) as { client_email: string; private_key: string };

    const objectId = `${issuerId}.cicla-bike-${bike.id}`;
    const passObject = {
      id: objectId,
      classId,
      state: "ACTIVE",
      genericType: "GENERIC_TYPE_UNSPECIFIED",
      cardTitle: { defaultValue: { language: "it-IT", value: "Cicla Qui" } },
      header: { defaultValue: { language: "it-IT", value: "Passaporto bici" } },
      subheader: { defaultValue: { language: "it-IT", value: `${bike.marca} ${bike.modello ?? ""}`.trim() } },
      textModulesData: [
        { id: "frame", header: "Telaio", body: bike.frame_number },
        { id: "color", header: "Colore", body: bike.colore ?? "—" },
      ],
      barcode: { type: "QR_CODE", value: bike.frame_number, alternateText: bike.frame_number },
    };

    const claims = {
      iss: sa.client_email,
      aud: "google",
      typ: "savetowallet",
      iat: Math.floor(Date.now() / 1000),
      payload: { genericObjects: [passObject] },
    };

    const key = await importPKCS8(sa.private_key, "RS256");
    const jwt = await new SignJWT(claims as Record<string, unknown>)
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .sign(key);

    return { configured: true as const, saveUrl: `https://pay.google.com/gp/v/save/${jwt}` };
  });

/**
 * Apple Wallet (.pkpass) requires Apple Developer pass-type certs (signing).
 * Returns {configured:false} for now; integration arrives in Sprint 9.5.
 */
export const getAppleWalletPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bike_id: string }) => d)
  .handler(async () => ({ configured: false as const }));
