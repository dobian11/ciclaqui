// POIs from OpenStreetMap via Overpass, proxied through a server function
// to avoid browser CORS / network blocks and to enable mirror fallback.
import { fetchPoisServer } from "./pois.functions";

export type PoiCategory = "water" | "parking" | "pump" | "place";

// Categorie mostrate nel pannello layer (escluso "place", usato solo per i
// risultati della ricerca testuale).
export const LAYER_CATEGORIES = ["water", "parking", "pump"] as const;

export interface Poi {
  id: string;
  category: PoiCategory;
  lat: number;
  lng: number;
  name?: string;
  tags?: Record<string, string>;
}

// Overpass diventa lentissimo su bbox molto grandi: limitiamo l'area
// interrogata a ~30 km attorno al centro della vista.
const MAX_SPAN_DEG = 0.28;
function clampBbox(b: [number, number, number, number]): [number, number, number, number] {
  const [s0, w0, n0, e0] = b;
  const cLat = (s0 + n0) / 2;
  const cLng = (w0 + e0) / 2;
  const halfLat = Math.min((n0 - s0) / 2, MAX_SPAN_DEG / 2);
  const halfLng = Math.min((e0 - w0) / 2, MAX_SPAN_DEG / 2);
  return [cLat - halfLat, cLng - halfLng, cLat + halfLat, cLng + halfLng];
}

const cache = new Map<string, { ts: number; data: Poi[] }>();
const TTL_MS = 10 * 60_000;

export async function fetchPois(
  bbox: [number, number, number, number],
  categories: PoiCategory[],
  signal?: AbortSignal,
): Promise<Poi[]> {
  if (categories.length === 0) return [];
  bbox = clampBbox(bbox);
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
    } else if (
      tags.amenity === "bicycle_repair_station" ||
      tags.amenity === "compressed_air" ||
      tags.shop === "bicycle"
    ) {
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
  pump: { label: "Officina / Gonfiaggio", color: "#F59E0B", emoji: "🔧" },
  place: { label: "Destinazione", color: "#00B86B", emoji: "📍" },
};
