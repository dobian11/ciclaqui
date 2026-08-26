/**
 * Keep-alive per il tracking su web/PWA.
 *
 * Con schermo bloccato iOS/Android sospendono la pagina e il GPS si ferma.
 * Un loop audio silenzioso tiene viva la media session (e quindi il processo
 * della pagina) anche in background: è il meccanismo usato dalle app di
 * navigazione/fitness web. Non è affidabile al 100% come il tracking nativo,
 * ma riduce drasticamente le interruzioni.
 *
 * Va avviato dentro un gesto utente (tap su Start / avvio percorso), altrimenti
 * il browser blocca la riproduzione.
 */

// WAV mono 8kHz, ~1s di silenzio (piccolissimo, in base64).
const SILENT_WAV =
  "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQ4AAAAAAAAAAAAAAAAAAAAAAA==";

let audio: HTMLAudioElement | null = null;
let onVisibility: (() => void) | null = null;

function createAudio(): HTMLAudioElement {
  const el = new Audio(SILENT_WAV);
  el.loop = true;
  el.volume = 0.001; // volume 0 può far scartare la sessione audio su iOS
  el.preload = "auto";
  el.setAttribute("playsinline", "true");
  return el;
}

/** Avvia il keep-alive. Va chiamato da un gesto utente. */
export async function startKeepAlive(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    audio = audio ?? createAudio();
    await audio.play();
    // Se il sistema mette in pausa il loop, riprendilo al ritorno in primo piano.
    onVisibility = () => {
      if (audio && audio.paused) void audio.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);
    // Media Session: evita che il sistema consideri la pagina inattiva.
    const ms = (navigator as unknown as { mediaSession?: { playbackState?: string } }).mediaSession;
    if (ms) ms.playbackState = "playing";
    return true;
  } catch {
    return false; // autoplay bloccato: restiamo con il solo Wake Lock
  }
}

/** Ferma il keep-alive e libera la sessione audio. */
export function stopKeepAlive() {
  if (onVisibility) {
    document.removeEventListener("visibilitychange", onVisibility);
    onVisibility = null;
  }
  try {
    audio?.pause();
    if (audio) audio.currentTime = 0;
  } catch {
    /* ignore */
  }
  const ms = (navigator as unknown as { mediaSession?: { playbackState?: string } })?.mediaSession;
  if (ms) ms.playbackState = "none";
}
