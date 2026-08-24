import { describe, it, expect } from "vitest";
import {
  ModeDetector,
  clampModeToSpeed,
  effectiveSpeedKmh,
  haversineMeters,
} from "./mode-detector";

function feed(d: ModeDetector, speeds: number[]) {
  let m = d.mode;
  for (const s of speeds) m = d.push(s);
  return m;
}

describe("ModeDetector", () => {
  it("fermo → a piedi", () => {
    const d = new ModeDetector();
    expect(feed(d, [0, 0.5, 0.2, 1])).toBe("foot");
  });

  it("camminata sostenuta resta a piedi", () => {
    const d = new ModeDetector();
    expect(feed(d, [3, 4, 5, 5.5, 4.5, 6])).toBe("foot");
  });

  it("bici a 18 km/h → bike (segnale forte, cambio rapido)", () => {
    const d = new ModeDetector();
    expect(feed(d, [16, 18, 19])).toBe("bike");
  });

  it("bici resta bike anche se rallenta a 7 km/h (isteresi)", () => {
    const d = new ModeDetector();
    feed(d, [15, 18, 20, 17]);
    expect(feed(d, [7, 7.2, 7.1, 7])).toBe("bike");
  });

  it("un picco GPS isolato non fa scattare l'auto (mediana)", () => {
    const d = new ModeDetector();
    feed(d, [15, 16, 17]);
    // un solo spike a 90 km/h in mezzo a velocità da bici
    expect(feed(d, [90, 16, 15, 16])).toBe("bike");
  });

  it("auto a 60 km/h sostenuti → car", () => {
    const d = new ModeDetector();
    expect(feed(d, [55, 60, 62])).toBe("car");
  });

  it("auto che scende a 20 km/h torna bici dopo la conferma", () => {
    const d = new ModeDetector();
    feed(d, [50, 55, 60]);
    expect(d.mode).toBe("car");
    expect(feed(d, [20, 19, 21, 20, 18, 20])).toBe("bike");
  });

  it("zona borderline 6.5-7.5 km/h non sfarfalla", () => {
    const d = new ModeDetector();
    feed(d, [14, 15, 16]); // bike
    const modes = [6.8, 7.2, 6.9, 7.4, 6.7, 7.1].map((s) => d.push(s));
    expect(new Set(modes).size).toBe(1); // mai cambiato
    expect(d.mode).toBe("bike");
  });
});

describe("effectiveSpeedKmh (fallback iOS senza speed GPS)", () => {
  const base = { lat: 45.4642, lng: 9.19, t: 0 };

  it("usa la velocità GPS quando presente", () => {
    expect(effectiveSpeedKmh(base, { ...base, t: 1000, speedKmh: 18 })).toBe(18);
  });

  it("deriva la velocità da distanza/tempo quando speed è null", () => {
    // ~111 m in 20 s ≈ 20 km/h
    const cur = { lat: 45.4652, lng: 9.19, t: 20000, speedKmh: null };
    const v = effectiveSpeedKmh(base, cur);
    expect(v).toBeGreaterThan(14);
    expect(v).toBeLessThan(26);
  });

  it("gap lungo senza fix → 0 (app in background, niente falsi positivi)", () => {
    const cur = { lat: 45.4752, lng: 9.19, t: 10 * 60 * 1000, speedKmh: null };
    expect(effectiveSpeedKmh(base, cur)).toBe(0);
  });

  it("GPS dice fermo ma il movimento reale è da bici → deriva", () => {
    const cur = { lat: 45.4652, lng: 9.19, t: 20000, speedKmh: 0 };
    const v = effectiveSpeedKmh(base, cur);
    expect(v).toBeGreaterThan(8);
  });
});

describe("haversineMeters", () => {
  it("distanza nota: 0.001° lat ≈ 111 m", () => {
    const d = haversineMeters({ lat: 45, lng: 9 }, { lat: 45.001, lng: 9 });
    expect(d).toBeGreaterThan(108);
    expect(d).toBeLessThan(114);
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
