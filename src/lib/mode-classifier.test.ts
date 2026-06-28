import { describe, it, expect } from "vitest";
import { classifySample, classifyTrip, FLAG_THRESHOLD } from "./mode-classifier";

describe("classifySample", () => {
  it("riconosce piedi (lento + variance alta)", () => {
    const r = classifySample({ speedKmh: 4, accelVariance: 3, headingDeltaDeg: 40 });
    expect(r.mode).toBe("foot");
  });
  it("riconosce bici (medio + variance media)", () => {
    const r = classifySample({ speedKmh: 18, accelVariance: 1, headingDeltaDeg: 10 });
    expect(r.mode).toBe("bike");
  });
  it("riconosce auto (veloce + heading stabile + variance bassa)", () => {
    const r = classifySample({ speedKmh: 60, accelVariance: 0.2, headingDeltaDeg: 2 });
    expect(r.mode).toBe("car");
    expect(r.confidence).toBeGreaterThanOrEqual(FLAG_THRESHOLD);
  });
});

describe("classifyTrip", () => {
  it("trip vuoto → fallback foot", () => {
    expect(classifyTrip([])).toEqual({ mode: "foot", confidence: 0, score: 0 });
  });
  it("la modalità dominante è quella della maggioranza dei sample", () => {
    const samples = [
      { speedKmh: 20, accelVariance: 1, headingDeltaDeg: 10 },
      { speedKmh: 22, accelVariance: 1.2, headingDeltaDeg: 12 },
      { speedKmh: 60, accelVariance: 0.2, headingDeltaDeg: 2 },
    ];
    expect(classifyTrip(samples).mode).toBe("bike");
  });
});
