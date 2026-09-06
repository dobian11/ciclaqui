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
 * Apple Wallet (.pkpass): genera e firma il pass del passaporto bici.
 *
 * Richiede i secret:
 *  - APPLE_PASS_TYPE_ID       (es. pass.it.ciclaqui.bike)
 *  - APPLE_TEAM_ID
 *  - APPLE_PASS_CERT_P12_BASE64  (certificato Pass Type ID esportato in .p12, base64)
 *  - APPLE_PASS_CERT_PASSWORD    (password del .p12; stringa vuota se assente)
 *  - APPLE_WWDR_CERT_PEM         (certificato intermedio Apple WWDR in PEM)
 *
 * Se mancano, ritorna { configured: false } e la UI mostra un avviso.
 */
export const getAppleWalletPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bike_id: string }) => d)
  .handler(async ({ data, context }) => {
    const passTypeId = process.env.APPLE_PASS_TYPE_ID;
    const teamId = process.env.APPLE_TEAM_ID;
    const p12 = process.env.APPLE_PASS_CERT_P12_BASE64;
    const wwdr = process.env.APPLE_WWDR_CERT_PEM;
    if (!passTypeId || !teamId || !p12 || !wwdr) {
      return { configured: false as const };
    }

    const { data: bike, error } = await context.supabase
      .from("bikes")
      .select("id, marca, modello, colore, frame_number, owner_id, qr_token")
      .eq("id", data.bike_id)
      .single();
    if (error || !bike) throw new Error("Bici non trovata");
    if (bike.owner_id !== context.userId) throw new Error("Non autorizzato");

    const { zipStore, sha1Hex, signManifest, bytesToBase64 } = await import("./pkpass.server");
    const { PUBLIC_APP_URL } = await import("./public-url");

    const origin = PUBLIC_APP_URL;
    const iconRes = await fetch(`${origin}/icons/icon-192.png`);
    if (!iconRes.ok) throw new Error("Icona del pass non disponibile");
    const icon = new Uint8Array(await iconRes.arrayBuffer());

    const pass = {
      formatVersion: 1,
      passTypeIdentifier: passTypeId,
      teamIdentifier: teamId,
      serialNumber: bike.id,
      organizationName: "Cicla Qui",
      description: "Passaporto bici Cicla Qui",
      logoText: "Cicla Qui",
      foregroundColor: "rgb(255,255,255)",
      backgroundColor: "rgb(10,15,13)",
      labelColor: "rgb(126,217,87)",
      barcodes: [
        {
          format: "PKBarcodeFormatQR",
          message: `${origin}/cerca-bici?token=${bike.qr_token}`,
          messageEncoding: "iso-8859-1",
          altText: bike.frame_number,
        },
      ],
      generic: {
        primaryFields: [
          { key: "bike", label: "Bici", value: `${bike.marca} ${bike.modello ?? ""}`.trim() },
        ],
        secondaryFields: [
          { key: "frame", label: "Telaio", value: bike.frame_number },
          { key: "color", label: "Colore", value: bike.colore ?? "—" },
        ],
        backFields: [
          {
            key: "info",
            label: "Come funziona",
            value:
              "Mostra questo QR per identificare la bici. In caso di furto segnala il furto dall'app: chi scansiona il codice vedrà l'avviso.",
          },
        ],
      },
    };

    const enc = new TextEncoder();
    const passJson = enc.encode(JSON.stringify(pass));

    const files: { name: string; data: Uint8Array }[] = [
      { name: "pass.json", data: passJson },
      { name: "icon.png", data: icon },
      { name: "icon@2x.png", data: icon },
      { name: "logo.png", data: icon },
    ];

    const manifest: Record<string, string> = {};
    for (const f of files) manifest[f.name] = await sha1Hex(f.data);
    const manifestBytes = enc.encode(JSON.stringify(manifest));

    const signature = await signManifest(
      manifestBytes,
      p12,
      process.env.APPLE_PASS_CERT_PASSWORD ?? "",
      wwdr,
    );

    const pkpass = zipStore([
      ...files,
      { name: "manifest.json", data: manifestBytes },
      { name: "signature", data: signature },
    ]);

    return {
      configured: true as const,
      filename: `cicla-qui-${bike.frame_number}.pkpass`,
      pkpassBase64: bytesToBase64(pkpass),
    };
  });

