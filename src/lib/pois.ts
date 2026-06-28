// Fetch POIs from OpenStreetMap via Overpass API.
// Free, no API key. Data: drinking water (nasoni), bike parking, bike pumps.

export type PoiCategory = "water" | "parking" | "pump";

export interface Poi {
  id: string;
  category: PoiCategory;
  lat: number;
  lng: number;
  name?: string;
  tags?: Record<string, string>;
}

const ENDPOINT = "https://overpass-api.de/api/interpreter";

// Tag filters per category. Coverage in Italy is excellent for these.
const QUERIES: Record<PoiCategory, (bbox: string) => string> = {
  water: (bbox) => `
    nwr["amenity"="drinking_water"](${bbox});
    nwr["man_made"="water_tap"]["drinking_water"!~"no"](${bbox});
    nwr["fountain"="drinking"](${bbox});
  `,
  parking: (bbox) => `
    nwr["amenity"="bicycle_parking"](${bbox});
  `,
  pump: (bbox) => `
    nwr["amenity"="bicycle_repair_station"](${bbox});
    nwr["amenity"="compressed_air"](${bbox});
  `,
};

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

// Simple in-memory cache keyed by bbox+cats, with TTL.
const cache = new Map<string, { ts: number; data: Poi[] }>();
const TTL_MS = 10 * 60_000;

export async function fetchPois(
  bbox: [number, number, number, number], // south, west, north, east
  categories: PoiCategory[],
  signal?: AbortSignal,
): Promise<Poi[]> {
  if (categories.length === 0) return [];
  const bboxStr = bbox.map((n) => n.toFixed(4)).join(",");
  const cacheKey = `${bboxStr}|${categories.sort().join(",")}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.data;

  const body = `[out:json][timeout:25];(${categories
    .map((c) => QUERIES[c](bboxStr))
    .join("\n")});out center 300;`;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    body: "data=" + encodeURIComponent(body),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    signal,
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = (await res.json()) as { elements: OverpassElement[] };

  const pois: Poi[] = [];
  for (const el of json.elements ?? []) {
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
