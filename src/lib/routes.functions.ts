import { createServerFn } from "@tanstack/react-start";
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

export const computeRoute = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !gmKey) {
      throw new Error("Google Maps connector non configurato");
    }

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
    if (travelMode === "DRIVE") {
      body.routingPreference = "TRAFFIC_AWARE";
    }

    const res = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmKey,
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Routes API ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      routes?: Array<{
        polyline?: { encodedPolyline?: string };
        distanceMeters?: number;
        duration?: string; // e.g. "423s"
      }>;
    };
    const route = json.routes?.[0];
    if (!route?.polyline?.encodedPolyline) {
      throw new Error("Nessun percorso disponibile");
    }
    const durationSec = route.duration ? parseInt(route.duration, 10) || 0 : 0;
    return {
      encoded: route.polyline.encodedPolyline,
      distanceMeters: route.distanceMeters ?? 0,
      durationSec,
    };
  });
