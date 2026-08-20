import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];

const schema = z.object({
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  categories: z.array(z.enum(["water", "parking", "pump"])).min(1),
});

const QUERIES = {
  water: (b: string) =>
    `nwr["amenity"="drinking_water"](${b});nwr["man_made"="water_tap"]["drinking_water"!~"no"](${b});nwr["fountain"="drinking"](${b});`,
  parking: (b: string) => `nwr["amenity"="bicycle_parking"](${b});`,
  pump: (b: string) =>
    `nwr["amenity"="bicycle_repair_station"](${b});nwr["amenity"="compressed_air"](${b});nwr["shop"="bicycle"](${b});`,
} as const;

export const fetchPoisServer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const bboxStr = data.bbox.map((n) => n.toFixed(4)).join(",");
    const body =
      "data=" +
      encodeURIComponent(
        `[out:json][timeout:12];(${data.categories
          .map((c) => QUERIES[c](bboxStr))
          .join("")});out center 250;`,
      );

    let lastErr: unknown = null;
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          body,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "CiclaQui/1.0 (+https://ciclaqui.app; contact@ciclaqui.app)",
            "Accept": "application/json",
            "Referer": "https://ciclaqui.app",
          },
          signal: AbortSignal.timeout(9000),
        });
        if (!res.ok) {
          lastErr = new Error(`Overpass ${res.status}`);
          continue;
        }
        const json = (await res.json()) as {
          elements: Array<{
            type: string;
            id: number;
            lat?: number;
            lon?: number;
            center?: { lat: number; lon: number };
            tags?: Record<string, string>;
          }>;
        };
        return { elements: json.elements ?? [] };
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error(
      `Overpass non raggiungibile: ${lastErr instanceof Error ? lastErr.message : "errore rete"}`,
    );
  });
