import { createServerFn } from "@tanstack/react-start";

/**
 * Restituisce la browser key di Google Maps da usare sul dominio custom
 * (ciclaqui.it). È una chiave referrer-restricted: può essere esposta al
 * client, esattamente come la chiave gestita da Lovable.
 */
export const getMapsBrowserKey = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env.GOOGLE_API_KEY ?? null;
  return { key };
});
