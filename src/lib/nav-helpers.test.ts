import { describe, it, expect } from "vitest";
import {
  NAV,
  haversineM,
  effectiveArrivedThresholdM,
  nearestPathNode,
  shouldTrimPath,
  shouldRecalcRoute,
  updateArrivalFixCounter,
  updateArrivalDwell,
  computeLiveRouteInfo,
} from "./nav-helpers";

const A = { lat: 45.4642, lng: 9.19 }; // Milano Duomo
const B = { lat: 45.4654, lng: 9.1903 }; // ~140 m a nord
const C = { lat: 45.4642, lng: 9.1902 }; // ~16 m a est

describe("haversineM", () => {
  it("≈0 sullo stesso punto", () => {
    expect(haversineM(A, A)).toBeLessThan(0.01);
  });
  it("distanza ragionevole tra 2 punti vicini", () => {
    const d = haversineM(A, B);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(180);
  });
});

describe("effectiveArrivedThresholdM", () => {
  it("default = ARRIVED_M con GPS buono", () => {
    expect(effectiveArrivedThresholdM(5)).toBe(NAV.ARRIVED_M);
    expect(effectiveArrivedThresholdM(null)).toBe(NAV.ARRIVED_M);
  });
  it("si allarga con accuracy alta", () => {
    expect(effectiveArrivedThresholdM(60)).toBe(48);
  });
  it("cappa a ARRIVED_MAX_M anche con GPS pessimo", () => {
    expect(effectiveArrivedThresholdM(500)).toBe(NAV.ARRIVED_MAX_M);
  });
});

describe("nearestPathNode + shouldTrimPath", () => {
  const path = [A, B, C, { lat: 45.466, lng: 9.191 }];
  it("trova il nodo più vicino", () => {
    const { index } = nearestPathNode(C, path);
    expect(index).toBe(2);
  });
  it("ritaglia solo da idx>=2", () => {
    expect(shouldTrimPath(0)).toBe(false);
    expect(shouldTrimPath(1)).toBe(false);
    expect(shouldTrimPath(2)).toBe(true);
  });
});

describe("shouldRecalcRoute", () => {
  const base = { recalcLocked: false, recalcInFlight: false };
  it("ricalcola se fuori soglia e GPS buono", () => {
    expect(
      shouldRecalcRoute({ ...base, nearestDistanceM: 50, accuracyM: 10 }),
    ).toBe(true);
  });
  it("NON ricalcola sotto soglia", () => {
    expect(
      shouldRecalcRoute({ ...base, nearestDistanceM: 10, accuracyM: 10 }),
    ).toBe(false);
  });
  it("NON ricalcola con GPS pessimo (evita falsi positivi)", () => {
    expect(
      shouldRecalcRoute({ ...base, nearestDistanceM: 100, accuracyM: 150 }),
    ).toBe(false);
  });
  it("NON ricalcola se lock attivo o richiesta in volo", () => {
    expect(
      shouldRecalcRoute({
        nearestDistanceM: 100,
        accuracyM: 10,
        recalcLocked: true,
        recalcInFlight: false,
      }),
    ).toBe(false);
    expect(
      shouldRecalcRoute({
        nearestDistanceM: 100,
        accuracyM: 10,
        recalcLocked: false,
        recalcInFlight: true,
      }),
    ).toBe(false);
  });
});

describe("updateArrivalFixCounter", () => {
  it("richiede N fix consecutivi entro soglia per confermare", () => {
    const r1 = updateArrivalFixCounter({
      distanceToDestM: 10,
      accuracyM: 5,
      previousCount: 0,
    });
    expect(r1).toEqual({ count: 1, arrived: false });
    const r2 = updateArrivalFixCounter({
      distanceToDestM: 10,
      accuracyM: 5,
      previousCount: r1.count,
    });
    expect(r2.arrived).toBe(true);
  });
  it("azzera il contatore se si allontana", () => {
    const r = updateArrivalFixCounter({
      distanceToDestM: 100,
      accuracyM: 5,
      previousCount: 1,
    });
    expect(r).toEqual({ count: 0, arrived: false });
  });
  it("azzera il contatore se GPS instabile (no falsi arrivi)", () => {
    const r = updateArrivalFixCounter({
      distanceToDestM: 10,
      accuracyM: 200,
      previousCount: 1,
    });
    expect(r).toEqual({ count: 0, arrived: false });
  });
});

describe("updateArrivalDwell", () => {
  it("inizia il dwell quando entra in raggio fermo", () => {
    const r = updateArrivalDwell({
      distanceToDestM: 30,
      speedKmh: 0.5,
      now: 1000,
      prevDwellStart: null,
    });
    expect(r).toEqual({ dwellStart: 1000, arrived: false });
  });
  it("conferma arrivo dopo ARRIVAL_DWELL_MS fermo entro raggio", () => {
    const r = updateArrivalDwell({
      distanceToDestM: 30,
      speedKmh: 0,
      now: 1000 + NAV.ARRIVAL_DWELL_MS,
      prevDwellStart: 1000,
    });
    expect(r.arrived).toBe(true);
  });
  it("resetta se l'utente riprende a muoversi", () => {
    const r = updateArrivalDwell({
      distanceToDestM: 30,
      speedKmh: 10,
      now: 9000,
      prevDwellStart: 1000,
    });
    expect(r).toEqual({ dwellStart: null, arrived: false });
  });
  it("resetta se esce dal raggio di dwell", () => {
    const r = updateArrivalDwell({
      distanceToDestM: 200,
      speedKmh: 0,
      now: 9000,
      prevDwellStart: 1000,
    });
    expect(r).toEqual({ dwellStart: null, arrived: false });
  });
});

describe("computeLiveRouteInfo", () => {
  it("ritorna null su percorso vuoto", () => {
    expect(
      computeLiveRouteInfo({
        current: A,
        path: [],
        originalDistanceM: 0,
        originalDurationSec: 0,
      }),
    ).toBeNull();
  });
  it("somma la distanza residua e cappa l'ETA all'originale", () => {
    const info = computeLiveRouteInfo({
      current: A,
      path: [B, C],
      originalDistanceM: 500,
      originalDurationSec: 120,
    })!;
    expect(info.distanceMeters).toBeGreaterThan(0);
    expect(info.durationSec).toBeGreaterThanOrEqual(15);
    expect(info.durationSec).toBeLessThanOrEqual(120);
  });
});
