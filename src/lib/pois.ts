// POIs from OpenStreetMap via Overpass, proxied through a server function
// to avoid browser CORS / network blocks and to enable mirror fallback.
import { fetchPoisServer } from "./pois.functions";

export type PoiCategory = "water" | "parking" | "pump";

export interface Poi {
  id: string;
  category: PoiCategory;
  lat: number;
  lng: number;
  name?: string;
  tags?: Record<string, string>;
}

const cache = new Map<string, { ts: number; data: Poi[] }>();
const TTL_MS = 10 * 60_000;

export async function fetchPois(
  bbox: [number, number, number, number],
  categories: PoiCategory[],
  signal?: AbortSignal,
): Promise<Poi[]> {
  if (categories.length === 0) return [];
  const bboxStr = bbox.map((n) => n.toFixed(4)).join(",");
  const cacheKey = `${bboxStr}|${categories.slice().sort().join(",")}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.data;

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const { elements } = await fetchPoisServer({
    data: { bbox, categories },
    signal,
  });

  const pois: Poi[] = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;
    const tags = el.tags ?? {};
    let category: PoiCategory | null = null;
    if (tags.amenity === "drinking_water" || tags.man_made === "water_tap" || tags.fountain === "drinking") {
      category = "water";
    } else if (tags.amenity === "bicycle_parking") {
      category = "parking";
    } else if (tags.amenity === "bicycle_repair_station" || tags.amenity === "compressed_air") {
      category = "pump";
    }
    if (!category || !categories.includes(category)) continue;
    pois.push({
      id: `${el.type[0]}${el.id}`,
      category,
      lat,
      lng,
      name: tags.name,
      tags,
    });
  }

  cache.set(cacheKey, { ts: Date.now(), data: pois });
  return pois;
}

export const POI_META: Record<PoiCategory, { label: string; color: string; emoji: string }> = {
  water: { label: "Acqua gratuita", color: "#3BA9F5", emoji: "💧" },
  parking: { label: "Parcheggio bici", color: "#8B5CF6", emoji: "🅿️" },
  pump: { label: "Gonfiaggio / Riparazione", color: "#F59E0B", emoji: "🔧" },
};
