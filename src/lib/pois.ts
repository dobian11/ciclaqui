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

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const BROWSER_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const BROWSER_QUERIES: Record<"water" | "parking" | "pump", (b: string) => string> = {
  water: (b) =>
    `nwr["amenity"="drinking_water"](${b});nwr["man_made"="water_tap"]["drinking_water"!~"no"](${b});nwr["fountain"="drinking"](${b});`,
  parking: (b) => `nwr["amenity"="bicycle_parking"](${b});`,
  pump: (b) =>
    `nwr["amenity"="bicycle_repair_station"](${b});nwr["amenity"="compressed_air"](${b});nwr["shop"="bicycle"](${b});`,
};

/** Interroga Overpass direttamente dal browser (CORS abilitato sui mirror). */
async function fetchPoisFromBrowser(
  bbox: [number, number, number, number],
  categories: PoiCategory[],
  signal?: AbortSignal,
): Promise<OverpassElement[]> {
  const b = bbox.map((n) => n.toFixed(4)).join(",");
  const parts = categories
    .filter((c): c is "water" | "parking" | "pump" => c in BROWSER_QUERIES)
    .map((c) => BROWSER_QUERIES[c](b))
    .join("");
  if (!parts) return [];
  const body = "data=" + encodeURIComponent(`[out:json][timeout:12];(${parts});out center 250;`);

  let lastErr: unknown = null;
  for (const url of BROWSER_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        body,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: signal ?? AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        lastErr = new Error(`Overpass ${res.status}`);
        continue;
      }
      const json = (await res.json()) as { elements?: OverpassElement[] };
      return json.elements ?? [];
    } catch (e) {
      if (signal?.aborted) throw e;
      lastErr = e;
    }
  }
  console.warn("Overpass non raggiungibile dal browser:", lastErr);
  return [];
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

  let elements: OverpassElement[];
  try {
    const res = await fetchPoisServer({ data: { bbox, categories }, signal });
    if (res.error) throw new Error(res.error);
    elements = res.elements as OverpassElement[];
  } catch (err) {
    if (signal?.aborted) throw err;
    // Fallback lato client: se la serverFn non è disponibile (nessuna sessione,
    // offline dal worker, errore 401/500) o Overpass è sovraccarico lato server,
    // interroghiamo Overpass direttamente dal browser.
    console.warn("POI server fallback:", err);
    elements = await fetchPoisFromBrowser(bbox, categories, signal);
  }


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
  for (const p of pois) knownPois.set(p.id, p);
  return pois;
}

// Store persistente di tutti i POI già scaricati nella sessione: serve a
// mostrarli immediatamente quando si riattiva un layer, senza aspettare
// Overpass (e a non farli "sparire" durante un refetch).
const knownPois = new Map<string, Poi>();

export function getKnownPois(categories: PoiCategory[]): Poi[] {
  if (categories.length === 0) return [];
  const out: Poi[] = [];
  for (const p of knownPois.values()) {
    if (categories.includes(p.category)) out.push(p);
  }
  return out;
}

export const POI_META: Record<PoiCategory, { label: string; color: string; emoji: string }> = {
  water: { label: "Acqua gratuita", color: "#3BA9F5", emoji: "💧" },
  parking: { label: "Parcheggio bici", color: "#8B5CF6", emoji: "🅿️" },
  pump: { label: "Officina / Gonfiaggio", color: "#F59E0B", emoji: "🔧" },
  place: { label: "Destinazione", color: "#00B86B", emoji: "📍" },
};
