import { describe, it, expect } from "vitest";
import { computeTripPoints, type PointsPerKm } from "./trip-points";

const PPK: PointsPerKm = { foot: 3, bike: 10, car: 0 };

const base = {
  anomaly: false,
  hasHints: true,
  bikeKm: 0,
  footM: 0,
  eligibleRatio: 1,
  eligibleKm: 0,
  mode: "bike" as const,
  pointsPerKm: PPK,
};

describe("computeTripPoints — con hint per-fix", () => {
  it("bici: 2,9 km → 29 pt (frazione di km non persa)", () => {
    expect(computeTripPoints({ ...base, bikeKm: 2.9 })).toBe(29);
  });

  it("bici: 0,9 km → 9 pt (niente zero sotto il km)", () => {
    expect(computeTripPoints({ ...base, bikeKm: 0.9 })).toBe(9);
  });

  it("bici: 10 km esatti → 100 pt", () => {
    expect(computeTripPoints({ ...base, bikeKm: 10 })).toBe(100);
  });

  it("piedi: 3 pt ogni 100 m completati (137 m → 3 pt)", () => {
    expect(computeTripPoints({ ...base, mode: "foot", footM: 137 })).toBe(3);
  });

  it("piedi: 99 m → 0 pt, 250 m → 6 pt", () => {
    expect(computeTripPoints({ ...base, mode: "foot", footM: 99 })).toBe(0);
    expect(computeTripPoints({ ...base, mode: "foot", footM: 250 })).toBe(6);
  });

  it("misto bici+piedi somma i due contributi", () => {
    // 1,5 km bici (15 pt) + 350 m piedi (9 pt) = 24 pt
    expect(computeTripPoints({ ...base, bikeKm: 1.5, footM: 350 })).toBe(24);
  });

  it("auto: 0 punti", () => {
    expect(computeTripPoints({ ...base, mode: "car" })).toBe(0);
  });

  it("cap giornaliero: quota proporzionale su entrambi i mezzi", () => {
    // ratio 0,5 → 2 km bici eleggibili 1 km (10 pt), 400 m piedi → 200 m (6 pt)
    expect(
      computeTripPoints({ ...base, bikeKm: 2, footM: 400, eligibleRatio: 0.5 }),
    ).toBe(16);
  });

  it("cap raggiunto: ratio 0 → 0 punti", () => {
    expect(computeTripPoints({ ...base, bikeKm: 5, eligibleRatio: 0 })).toBe(0);
  });
});

describe("computeTripPoints — senza hint (mezzo dichiarato)", () => {
  const noHints = { ...base, hasHints: false };

  it("bici: 2,9 km eleggibili → 29 pt", () => {
    expect(computeTripPoints({ ...noHints, mode: "bike", eligibleKm: 2.9 })).toBe(29);
  });

  it("piedi: 0,137 km → 1 blocco da 100 m → 3 pt", () => {
    expect(computeTripPoints({ ...noHints, mode: "foot", eligibleKm: 0.137 })).toBe(3);
  });

  it("piedi: 0,099 km → 0 pt", () => {
    expect(computeTripPoints({ ...noHints, mode: "foot", eligibleKm: 0.099 })).toBe(0);
  });

  it("auto: sempre 0 pt", () => {
    expect(computeTripPoints({ ...noHints, mode: "car", eligibleKm: 12 })).toBe(0);
  });
});

describe("computeTripPoints — anomalie", () => {
  it("viaggio anomalo → 0 punti a prescindere dalla distanza", () => {
    expect(computeTripPoints({ ...base, anomaly: true, bikeKm: 30 })).toBe(0);
    expect(
      computeTripPoints({ ...base, anomaly: true, hasHints: false, mode: "bike", eligibleKm: 30 }),
    ).toBe(0);
  });
});
