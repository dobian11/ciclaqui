import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const schema = z.object({
  origin: z.object({ lat: z.number(), lng: z.number() }),
  destination: z.object({ lat: z.number(), lng: z.number() }),
  mode: z.enum(["bike", "foot", "car"]).default("bike"),
});

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

/** Calcolo del percorso tramite OSRM/OpenStreetMap, senza API key. */
export const computeRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }): Promise<RouteResult> => {
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
