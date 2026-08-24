import { describe, it, expect } from "vitest";
import {
  classifySample,
  classifyWindow,
  StreamingModeClassifier,
  clampModeToSpeed,
  FLAG_THRESHOLD,
} from "./mode-classifier";

describe("classifySample (sensor-fusion + bike boost)", () => {
  it("bassa velocità + alta varianza accelerometro → foot", () => {
    const r = classifySample({ speedKmh: 4, accelVariance: 5, headingDeltaDeg: 25 });
    expect(r.mode).toBe("foot");
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it("fascia ciclismo 18 km/h + varianza media → bike (verde) per bike boost", () => {
    const r = classifySample({ speedKmh: 18, accelVariance: 1.2, headingDeltaDeg: 10 });
    expect(r.mode).toBe("bike");
    expect(r.confidence).toBeGreaterThan(FLAG_THRESHOLD);
  });

  it("velocità ambigua 12 km/h ma heading stabile → comunque bike per bike boost", () => {
    const r = classifySample({ speedKmh: 12, accelVariance: 0.8, headingDeltaDeg: 5 });
    expect(r.mode).toBe("bike");
  });

  it("alta velocità + bassa varianza → car", () => {
    const r = classifySample({ speedKmh: 70, accelVariance: 0.2, headingDeltaDeg: 2 });
    expect(r.mode).toBe("car");
    expect(r.confidence).toBeGreaterThan(0.7);
  });

  it("sensori assenti (0,0) ma velocità da bici → bike", () => {
    const r = classifySample({ speedKmh: 20, accelVariance: 0, headingDeltaDeg: 0 });
    expect(r.mode).toBe("bike");
  });
});

describe("StreamingModeClassifier", () => {
  it("conferma bici dopo pochi campioni coerenti", () => {
    const c = new StreamingModeClassifier();
    for (let i = 0; i < 5; i++) {
      c.push({ speedKmh: 18, accelVariance: 1.0, headingDeltaDeg: 8 });
    }
    expect(c.mode).toBe("bike");
    expect(c.confidence).toBeGreaterThan(FLAG_THRESHOLD);
  });

  it("reset torna a foot", () => {
    const c = new StreamingModeClassifier();
    c.push({ speedKmh: 60, accelVariance: 0.1, headingDeltaDeg: 1 });
    expect(c.mode).toBe("car");
    c.reset();
    expect(c.mode).toBe("foot");
    expect(c.confidence).toBe(0);
  });
});

describe("classifyWindow", () => {
  it("finestra mista ma prevalente bici → bike", () => {
    const samples = [
      { speedKmh: 10, accelVariance: 1.5, headingDeltaDeg: 12 },
      { speedKmh: 18, accelVariance: 1.1, headingDeltaDeg: 9 },
      { speedKmh: 22, accelVariance: 0.9, headingDeltaDeg: 7 },
      { speedKmh: 16, accelVariance: 1.3, headingDeltaDeg: 10 },
    ];
    const r = classifyWindow(samples);
    expect(r.mode).toBe("bike");
  });
});

describe("clampModeToSpeed (anti-frode)", () => {
  it("piedi a 5 km/h ok, a 20 km/h diventa bici", () => {
    expect(clampModeToSpeed("foot", 5)).toBe("foot");
    expect(clampModeToSpeed("foot", 20)).toBe("bike");
  });
  it("bici a 30 km/h ok, a 60 diventa auto", () => {
    expect(clampModeToSpeed("bike", 30)).toBe("bike");
    expect(clampModeToSpeed("bike", 60)).toBe("car");
  });
  it("auto resta auto", () => {
    expect(clampModeToSpeed("car", 10)).toBe("car");
  });
});
