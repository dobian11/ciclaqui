/**
 * URL pubblica dell'app usata nelle email (link "Vai alla dashboard").
 * NON usare window.location.origin: nell'editor/preview genererebbe link
 * verso il dominio di anteprima Lovable invece che al sito reale.
 */
export const PUBLIC_APP_URL = "https://ciclaqui.it";

/**
 * Origin da usare per i link inviati via email (conferma iscrizione, reset password,
 * inviti). Nell'editor/anteprima Lovable ritorna sempre il dominio pubblico reale,
 * così l'utente non atterra su un URL `*.lovable.app` / `lovable.dev`.
 */
export function emailLinkOrigin(): string {
  if (typeof window === "undefined") return PUBLIC_APP_URL;
  const host = window.location.hostname;
  const isPreview =
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev") ||
    host === "localhost" ||
    host === "127.0.0.1";
  return isPreview ? PUBLIC_APP_URL : window.location.origin;
}
