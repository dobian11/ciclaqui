import { createServerFn } from "@tanstack/react-start";

/**
 * Diagnostica temporanea: verifica che la Google API key funzioni con i
 * referrer di ciclaqui.it. Non restituisce mai la chiave.
 */
export const checkMapsKey = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return { ok: false, error: "GOOGLE_API_KEY non configurata" };

  const results: Record<string, string> = {};
  for (const referer of ["https://ciclaqui.it/", "https://www.ciclaqui.it/"]) {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`,
      { headers: { Referer: referer } },
    );
    const text = (await res.text()).slice(0, 300);
    results[referer] = `${res.status} ${text.includes("RefererNotAllowed") || text.includes("InvalidKey") || text.includes("ApiNotActivated") ? text.replace(/\s+/g, " ") : "OK"}`;
  }
  return { ok: true, results };
});
