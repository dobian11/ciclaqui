// Validazione IBAN condivisa (client + server).
// - Rimuove spazi, upper-case
// - Controlla country code (ISO 3166-1 alpha-2 supportati con lunghezza attesa)
// - Verifica lunghezza per paese
// - Calcola checksum MOD-97 (IBAN valido ⇔ resto = 1)
// - Formatta a gruppi di 4 caratteri

// Lunghezze IBAN ufficiali per paese (subset dei più comuni + UE completa).
// Fonte: SWIFT IBAN Registry.
const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28,
  BA: 20, BE: 16, BG: 22, BH: 22, BR: 29, BY: 28,
  CH: 21, CR: 22, CY: 28, CZ: 24,
  DE: 22, DK: 18, DO: 28,
  EE: 20, EG: 29, ES: 24,
  FI: 18, FO: 18, FR: 27,
  GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28,
  HR: 21, HU: 28,
  IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27,
  JO: 30,
  KW: 30, KZ: 20,
  LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, LY: 25,
  MC: 27, MD: 24, ME: 22, MK: 19, MR: 27, MT: 31, MU: 30,
  NL: 18, NO: 15,
  PK: 24, PL: 28, PS: 29, PT: 25,
  QA: 29,
  RO: 24, RS: 22,
  SA: 24, SC: 31, SE: 24, SI: 19, SK: 24, SM: 27, ST: 25, SV: 28,
  TL: 23, TN: 24, TR: 26,
  UA: 29,
  VA: 22, VG: 24,
  XK: 20,
};

export type IbanValidation =
  | { ok: true; iban: string; formatted: string; country: string }
  | { ok: false; reason: string };

export function normalizeIban(input: string): string {
  return (input ?? "").replace(/\s+/g, "").toUpperCase();
}

export function formatIban(input: string): string {
  const clean = normalizeIban(input);
  return clean.replace(/(.{4})/g, "$1 ").trim();
}

export function validateIban(input: string): IbanValidation {
  const iban = normalizeIban(input);

  if (!iban) return { ok: false, reason: "Inserisci un IBAN" };
  if (iban.length < 15) return { ok: false, reason: "IBAN troppo corto" };
  if (iban.length > 34) return { ok: false, reason: "IBAN troppo lungo" };

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) {
    return { ok: false, reason: "Formato non valido: prefisso deve essere 2 lettere + 2 cifre" };
  }

  const country = iban.slice(0, 2);
  const expected = IBAN_LENGTHS[country];
  if (!expected) {
    return { ok: false, reason: `Paese "${country}" non riconosciuto` };
  }
  if (iban.length !== expected) {
    return {
      ok: false,
      reason: `IBAN ${country} deve avere ${expected} caratteri (ricevuti ${iban.length})`,
    };
  }

  // MOD-97: sposta le prime 4 in coda, converti lettere in numeri (A=10..Z=35),
  // il resto della divisione per 97 deve essere 1.
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const digit = code >= 65 ? code - 55 : code - 48; // A→10, 0→0
    // BigInt evitato: costruiamo il resto a blocchi per stare in Number safe range
    remainder = (remainder * (digit >= 10 ? 100 : 10) + digit) % 97;
  }
  if (remainder !== 1) {
    return { ok: false, reason: "Cifre di controllo IBAN errate" };
  }

  return { ok: true, iban, formatted: formatIban(iban), country };
}
