import { describe, it, expect } from "vitest";
import { decodePolyline } from "./polyline";

describe("decodePolyline", () => {
  it("decodifica l'esempio canonico di Google", () => {
    // "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
    // → [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)]
    const pts = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(pts).toHaveLength(3);
    expect(pts[0].lat).toBeCloseTo(38.5, 5);
    expect(pts[0].lng).toBeCloseTo(-120.2, 5);
    expect(pts[2].lat).toBeCloseTo(43.252, 3);
    expect(pts[2].lng).toBeCloseTo(-126.453, 3);
  });
  it("stringa vuota → array vuoto", () => {
    expect(decodePolyline("")).toEqual([]);
  });
});
