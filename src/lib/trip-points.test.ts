import { describe, it, expect } from "vitest";
import { computeLivePointsPreview, computeTripPoints, type PointsPerKm } from "./trip-points";

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

  it("bici: 1,0 km esatto → 10 pt", () => {
    expect(computeTripPoints({ ...base, bikeKm: 1 })).toBe(10);
  });

  it("bici: 10 km esatti → 100 pt", () => {
    expect(computeTripPoints({ ...base, bikeKm: 10 })).toBe(100);
  });

  it("bici: regressioni arrotondamento (0,1→1, 0,99→9, 1,99→19, 3,33→33)", () => {
    expect(computeTripPoints({ ...base, bikeKm: 0.1 })).toBe(1);
    expect(computeTripPoints({ ...base, bikeKm: 0.99 })).toBe(9);
    expect(computeTripPoints({ ...base, bikeKm: 1.99 })).toBe(19);
    expect(computeTripPoints({ ...base, bikeKm: 3.33 })).toBe(33);
  });

  it("bici: distanza nulla → 0 pt", () => {
    expect(computeTripPoints({ ...base, bikeKm: 0 })).toBe(0);
  });

  it("piedi: 3 pt ogni 100 m completati (137 m → 3 pt)", () => {
    expect(computeTripPoints({ ...base, mode: "foot", footM: 137 })).toBe(3);
  });

  it("piedi: 99 m → 0 pt, 250 m → 6 pt", () => {
    expect(computeTripPoints({ ...base, mode: "foot", footM: 99 })).toBe(0);
    expect(computeTripPoints({ ...base, mode: "foot", footM: 250 })).toBe(6);
  });

  it("piedi: regressione 900 m → 27 pt (9 blocchi da 100 m × 3 pt)", () => {
    expect(computeTripPoints({ ...base, mode: "foot", footM: 900 })).toBe(27);
  });

  it("piedi: valori di confine blocchi (100 m→3, 199 m→3, 200 m→6, 1000 m→30)", () => {
    expect(computeTripPoints({ ...base, mode: "foot", footM: 100 })).toBe(3);
    expect(computeTripPoints({ ...base, mode: "foot", footM: 199 })).toBe(3);
    expect(computeTripPoints({ ...base, mode: "foot", footM: 200 })).toBe(6);
    expect(computeTripPoints({ ...base, mode: "foot", footM: 1000 })).toBe(30);
  });

  it("piedi: cap proporzionale — 900 m con ratio 0,5 → 450 m → 12 pt", () => {
    expect(
      computeTripPoints({ ...base, mode: "foot", footM: 900, eligibleRatio: 0.5 }),
    ).toBe(12);
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

  it("piedi: regressione 900 m (0,9 km) → 27 pt, 1,0 km → 30 pt", () => {
    expect(computeTripPoints({ ...noHints, mode: "foot", eligibleKm: 0.9 })).toBe(27);
    expect(computeTripPoints({ ...noHints, mode: "foot", eligibleKm: 1 })).toBe(30);
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

describe("computeLivePointsPreview — anteprima client (specchio del ramo hasHints)", () => {
  const d = (foot: number, bike: number, car = 0) => ({ foot, bike, car });

  it("bici: regressione 0,9 km → 9 pt, 2,9 km → 29 pt, 1,0 km → 10 pt", () => {
    expect(computeLivePointsPreview(d(0, 0.9), PPK)).toBe(9);
    expect(computeLivePointsPreview(d(0, 2.9), PPK)).toBe(29);
    expect(computeLivePointsPreview(d(0, 1.0), PPK)).toBe(10);
  });

  it("piedi: regressione 900 m → 27 pt, blocchi da 100 m", () => {
    expect(computeLivePointsPreview(d(0.9, 0), PPK)).toBe(27);
    expect(computeLivePointsPreview(d(0.199, 0), PPK)).toBe(3);
    expect(computeLivePointsPreview(d(0.2, 0), PPK)).toBe(6);
  });

  it("viaggio misto: somma bici + piedi, auto ignorata", () => {
    expect(computeLivePointsPreview(d(0.3, 1.5, 4.2), PPK)).toBe(15 + 9);
  });

  it("viaggio vuoto / solo auto → 0 pt", () => {
    expect(computeLivePointsPreview(d(0, 0, 0), PPK)).toBe(0);
    expect(computeLivePointsPreview(d(0, 0, 8.5), PPK)).toBe(0);
  });

  it("rispetta le tariffe configurate dall'ente", () => {
    const custom = { foot: 5, bike: 12, car: 0 };
    expect(computeLivePointsPreview(d(0.5, 2.0), custom)).toBe(24 + 25);
  });
});
