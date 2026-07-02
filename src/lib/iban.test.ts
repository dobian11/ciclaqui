import { describe, it, expect } from "vitest";
import { validateIban, formatIban, normalizeIban } from "./iban";

describe("iban", () => {
  it("valida IBAN IT reale", () => {
    const r = validateIban("IT60 X054 2811 1010 0000 0123 456");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.iban).toBe("IT60X0542811101000000123456");
      expect(r.country).toBe("IT");
    }
  });

  it("valida IBAN DE reale", () => {
    expect(validateIban("DE89 3704 0044 0532 0130 00").ok).toBe(true);
  });

  it("valida IBAN GB reale", () => {
    expect(validateIban("GB82 WEST 1234 5698 7654 32").ok).toBe(true);
  });

  it("rifiuta checksum sbagliato", () => {
    const r = validateIban("IT99X0542811101000000123456");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/controllo/i);
  });

  it("rifiuta lunghezza sbagliata per paese", () => {
    const r = validateIban("IT60X05428111010");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/27 caratteri/);
  });

  it("rifiuta paese sconosciuto", () => {
    const r = validateIban("ZZ00X05428111010000001234");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/non riconosciuto/);
  });

  it("rifiuta formato non valido", () => {
    expect(validateIban("XXXXXXXXXXXXXXXX").ok).toBe(false);
  });

  it("rifiuta vuoto", () => {
    expect(validateIban("").ok).toBe(false);
  });

  it("normalizeIban rimuove spazi e uppercase", () => {
    expect(normalizeIban(" it60 x054 ")).toBe("IT60X054");
  });

  it("formatIban a gruppi di 4", () => {
    expect(formatIban("IT60X0542811101000000123456")).toBe(
      "IT60 X054 2811 1010 0000 0123 456",
    );
  });
});
