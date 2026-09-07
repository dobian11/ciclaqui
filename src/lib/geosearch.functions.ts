import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const schema = z.object({
  q: z.string().trim().min(3).max(120),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export interface GeoSearchResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

/** Ricerca indirizzi e luoghi tramite Nominatim/OpenStreetMap, senza API key. */
export const searchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }): Promise<{ results: GeoSearchResult[]; source: string }> => {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", data.q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "0");
    url.searchParams.set("limit", "6");
    url.searchParams.set("accept-language", "it");
    if (data.lat != null && data.lng != null) {
      const d = 0.6;
      url.searchParams.set(
        "viewbox",
        `${data.lng - d},${data.lat + d},${data.lng + d},${data.lat - d}`,
      );
    }
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "CiclaQui/1.0 (+https://ciclaqui.it)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Ricerca non disponibile (${res.status})`);
    const list = (await res.json()) as Array<{
      place_id: number;
      display_name: string;
      name?: string;
      lat: string;
      lon: string;
    }>;
    return {
      source: "osm",
      results: list.map((r) => ({
        id: `o:${r.place_id}`,
        name: r.name || r.display_name.split(",")[0],
        address: r.display_name,
        lat: Number(r.lat),
        lng: Number(r.lon),
      })),
    };
  });
