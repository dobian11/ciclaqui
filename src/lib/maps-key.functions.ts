import { createServerFn } from "@tanstack/react-start";

/**
 * Restituisce la browser key di Google Maps da usare sul dominio custom
 * (ciclaqui.it). È una chiave referrer-restricted: può essere esposta al
 * client, esattamente come la chiave gestita da Lovable.
 */
export const getMapsBrowserKey = createServerFn({ method: "GET" }).handler(async () => {
  // Preferisce la connessione Google dell'utente (dominio custom); la vecchia
  // chiave manuale GOOGLE_API_KEY resta come ultima risorsa.
  const key =
    process.env.GOOGLE_MAPS_BROWSER_KEY_1 ??
    process.env.GOOGLE_MAPS_API_KEY_1 ??
    process.env.GOOGLE_API_KEY ??
    null;
  return { key };
});
