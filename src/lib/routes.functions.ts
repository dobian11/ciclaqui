import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const schema = z.object({
  origin: z.object({ lat: z.number(), lng: z.number() }),
  destination: z.object({ lat: z.number(), lng: z.number() }),
  mode: z.enum(["bike", "foot", "car"]).default("bike"),
});

const TRAVEL_MODE = {
  bike: "BICYCLE",
  foot: "WALK",
  car: "DRIVE",
} as const;

const OSRM_PROFILE = {
  bike: "bike",
  foot: "foot",
  car: "car",
} as const;

interface RouteResult {
  encoded: string;
  distanceMeters: number;
  durationSec: number;
}

function buildBody(data: z.infer<typeof schema>) {
  const travelMode = TRAVEL_MODE[data.mode];
  const body: Record<string, unknown> = {
    origin: { location: { latLng: { latitude: data.origin.lat, longitude: data.origin.lng } } },
    destination: {
      location: { latLng: { latitude: data.destination.lat, longitude: data.destination.lng } },
    },
    travelMode,
    polylineQuality: "HIGH_QUALITY",
    languageCode: "it",
    units: "METRIC",
  };
  // Routing preference is only valid for DRIVE/TWO_WHEELER
  if (travelMode === "DRIVE") body.routingPreference = "TRAFFIC_AWARE";
  return body;
}

function parseGoogle(json: any): RouteResult | null {
  const route = json?.routes?.[0];
  if (!route?.polyline?.encodedPolyline) return null;
  return {
    encoded: route.polyline.encodedPolyline,
    distanceMeters: route.distanceMeters ?? 0,
    durationSec: route.duration ? parseInt(String(route.duration), 10) || 0 : 0,
  };
}

/**
 * Calcolo percorso. Ordine di tentativi:
 * 1) Connector gateway Google Maps (se il connector è collegato)
 * 2) Routes API diretta con GOOGLE_API_KEY (dominio custom)
 * 3) OSRM (OpenStreetMap, senza chiave) così la navigazione funziona sempre
 */
export const computeRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }): Promise<RouteResult> => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmKey = process.env.GOOGLE_MAPS_API_KEY;
    const directKey = process.env.GOOGLE_API_KEY;
    const fieldMask =
      "routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration";

    // 1) Gateway
    if (lovableKey && gmKey) {
      try {
        const res = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": gmKey,
            "Content-Type": "application/json",
            "X-Goog-FieldMask": fieldMask,
          },
          body: JSON.stringify(buildBody(data)),
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          const parsed = parseGoogle(await res.json());
          if (parsed) return parsed;
        } else {
          console.error("[routes] gateway", res.status, (await res.text()).slice(0, 200));
        }
      } catch (e) {
        console.error("[routes] gateway exception", e);
      }
    }

    // 2) Chiave diretta dell'utente
    if (directKey) {
      try {
        const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": directKey,
            "X-Goog-FieldMask": fieldMask,
          },
          body: JSON.stringify(buildBody(data)),
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          const parsed = parseGoogle(await res.json());
          if (parsed) return parsed;
        } else {
          console.error("[routes] direct", res.status, (await res.text()).slice(0, 200));
        }
      } catch (e) {
        console.error("[routes] direct exception", e);
      }
    }

    // 3) OSRM (OpenStreetMap)
    const profile = OSRM_PROFILE[data.mode];
    const url =
      `https://router.project-osrm.org/route/v1/${profile}/` +
      `${data.origin.lng},${data.origin.lat};${data.destination.lng},${data.destination.lat}` +
      `?overview=full&geometries=polyline`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`Percorso non disponibile (${res.status})`);
    const json = (await res.json()) as {
      routes?: Array<{ geometry?: string; distance?: number; duration?: number }>;
    };
    const r = json.routes?.[0];
    if (!r?.geometry) throw new Error("Nessun percorso disponibile");
    return {
      encoded: r.geometry,
      distanceMeters: Math.round(r.distance ?? 0),
      durationSec: Math.round(r.duration ?? 0),
    };
  });
