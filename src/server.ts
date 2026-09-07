import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/**
 * Aggiunge gli header di sicurezza a ogni risposta HTTP.
 *
 * - X-Frame-Options: DENY + CSP frame-ancestors 'none' → protezione ClickJacking
 * - Content-Security-Policy: limita sorgenti di script, oggetti, base-uri e frame
 * - Referrer-Policy: no-referrer-when-downgrade
 * - X-Content-Type-Options: nosniff
 */
function addSecurityHeaders(response: Response): Response {
  // Non sovrascrivere header già presenti; non aggiungere CSP a risposte non HTML/XML
  // (asset statici, JSON, XML sitemap, ecc.) per evitare conflitti con i loro content-type.
  const contentType = response.headers.get("content-type") ?? "";
  const isDocument = contentType.includes("text/html") || contentType.includes("application/xml") || contentType.includes("text/xml");

  const headers = new Headers(response.headers);

  // Protezione ClickJacking: sia header legacy che CSP moderna
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer-when-downgrade");
  headers.set("X-Content-Type-Options", "nosniff");

  if (isDocument) {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://*.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.supabase.co https://*.googleapis.com https://*.gstatic.com https://*.openstreetmap.org https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://maps.mail.ru",
      "font-src 'self' https://fonts.gstatic.com",
      "media-src 'self' data: blob:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://connector-gateway.lovable.dev https://*.googleapis.com https://oauth2.googleapis.com https://routes.googleapis.com https://places.googleapis.com https://fcm.googleapis.com https://air-quality-api.open-meteo.com https://*.openstreetmap.org https://overpass.openstreetmap.fr https://overpass.kumi.systems https://overpass-api.de https://nominatim.openstreetmap.org https://router.project-osrm.org https://pay.google.com",
      "frame-src 'self' https://*.supabase.co https://*.google.com https://accounts.google.com https://pay.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");
    headers.set("Content-Security-Policy", csp);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return addSecurityHeaders(normalized);
    } catch (error) {
      console.error(error);
      const response = new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
      return addSecurityHeaders(response);
    }
  },
};
