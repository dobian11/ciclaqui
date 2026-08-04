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

/**
 * Ricerca indirizzi/luoghi. Prova prima Google Places (New) con la chiave del
 * progetto; se la API non è abilitata sulla chiave (403) ricade su Nominatim
 * (OpenStreetMap), così la barra di ricerca funziona comunque.
 */
export const searchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }): Promise<{ results: GeoSearchResult[]; source: string }> => {
    const key = process.env.GOOGLE_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmKey = process.env.GOOGLE_MAPS_API_KEY;

    const parse = (json: any): GeoSearchResult[] =>
      (json?.places ?? [])
        .filter((p: any) => p.location)
        .map((p: any) => ({
          id: `g:${p.id}`,
          name: p.displayName?.text ?? p.formattedAddress ?? data.q,
          address: p.formattedAddress ?? "",
          lat: p.location.latitude,
          lng: p.location.longitude,
        }));

    const searchBody: Record<string, unknown> = {
      textQuery: data.q,
      languageCode: "it",
      regionCode: "IT",
      maxResultCount: 6,
    };
    if (data.lat != null && data.lng != null) {
      searchBody.locationBias = {
        circle: { center: { latitude: data.lat, longitude: data.lng }, radius: 40000 },
      };
    }
    const fieldMask =
      "places.id,places.displayName,places.formattedAddress,places.location";

    // 1) Connector gateway Google Maps
    if (lovableKey && gmKey) {
      try {
        const res = await fetch(
          "https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableKey}`,
              "X-Connection-Api-Key": gmKey,
              "Content-Type": "application/json",
              "X-Goog-FieldMask": fieldMask,
            },
            body: JSON.stringify(searchBody),
            signal: AbortSignal.timeout(8000),
          },
        );
        if (res.ok) {
          const results = parse(await res.json());
          if (results.length > 0) return { results, source: "google-gateway" };
        } else {
          console.error("[geosearch] gateway", res.status, (await res.text()).slice(0, 200));
        }
      } catch (e) {
        console.error("[geosearch] gateway exception", e);
      }
    }

    if (key) {

      try {
        const body: Record<string, unknown> = {
          textQuery: data.q,
          languageCode: "it",
          regionCode: "IT",
          maxResultCount: 6,
        };
        if (data.lat != null && data.lng != null) {
          body.locationBias = {
            circle: { center: { latitude: data.lat, longitude: data.lng }, radius: 40000 },
          };
        }
        const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.formattedAddress,places.location",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const json = (await res.json()) as {
            places?: Array<{
              id: string;
              displayName?: { text?: string };
              formattedAddress?: string;
              location?: { latitude: number; longitude: number };
            }>;
          };
          const results = (json.places ?? [])
            .filter((p) => p.location)
            .map((p) => ({
              id: `g:${p.id}`,
              name: p.displayName?.text ?? p.formattedAddress ?? data.q,
              address: p.formattedAddress ?? "",
              lat: p.location!.latitude,
              lng: p.location!.longitude,
            }));
          if (results.length > 0) return { results, source: "google" };
        }
      } catch {
        /* fallback sotto */
      }
    }

    // Fallback OpenStreetMap
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
