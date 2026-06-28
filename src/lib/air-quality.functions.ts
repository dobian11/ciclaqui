import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Qualità dell'aria via Google Air Quality API (più preciso di Open-Meteo).
 * Ritorna AQI universale + PM2.5 + categoria human-readable.
 */
export const getAirQuality = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !connKey) {
      return { aqi: null, pm25: null, category: "—", source: "unconfigured" as const };
    }

    try {
      const res = await fetch(`${GATEWAY_URL}/airquality/v1/currentConditions:lookup`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": connKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: { latitude: data.lat, longitude: data.lng },
          extraComputations: ["LOCAL_AQI", "POLLUTANT_CONCENTRATION"],
          languageCode: "it",
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("[airquality] gateway failed", res.status, txt);
        return { aqi: null, pm25: null, category: "—", source: "error" as const };
      }

      const json: any = await res.json();
      const indexes: any[] = json?.indexes ?? [];
      const local = indexes.find((i) => i.code !== "uaqi") ?? indexes[0];
      const aqi = local?.aqi ?? null;
      const category = local?.category ?? "—";
      const pollutants: any[] = json?.pollutants ?? [];
      const pm25 = pollutants.find((p) => p.code === "pm25")?.concentration?.value ?? null;

      return {
        aqi,
        pm25: pm25 != null ? Math.round(pm25 * 10) / 10 : null,
        category,
        source: "google" as const,
      };
    } catch (e) {
      console.error("[airquality] exception", e);
      return { aqi: null, pm25: null, category: "—", source: "error" as const };
    }
  });
