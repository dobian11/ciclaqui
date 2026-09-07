import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Qualità dell'aria via Google Air Quality API.
 * Fallback su Open-Meteo se Google non risponde (così l'UI non resta vuota).
 */
export const getAirQuality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GOOGLE_MAPS_API_KEY_1 ?? process.env.GOOGLE_MAPS_API_KEY;

    // --- 1) Tenta Google Air Quality
    if (lovableKey && connKey) {
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
            extraComputations: ["LOCAL_AQI", "POLLUTANT_CONCENTRATION", "DOMINANT_POLLUTANT_CONCENTRATION"],
            languageCode: "it",
          }),
        });

        if (res.ok) {
          const json: any = await res.json();
          const indexes: any[] = json?.indexes ?? [];
          const local = indexes.find((i) => i.code && i.code !== "uaqi") ?? indexes[0];
          const aqi = local?.aqi ?? null;
          const category = local?.category ?? "—";
          const pollutants: any[] = json?.pollutants ?? [];
          const pick = (code: string) =>
            pollutants.find((p) => p.code === code)?.concentration?.value ?? null;
          const pm25 = pick("pm25");
          if (aqi != null) {
            return {
              aqi,
              pm25: pm25 != null ? Math.round(pm25 * 10) / 10 : null,
              category,
              source: "google" as const,
            };
          }
        } else {
          const txt = await res.text().catch(() => "");
          console.error("[airquality] google failed", res.status, txt.slice(0, 200));
        }
      } catch (e) {
        console.error("[airquality] google exception", e);
      }
    }

    // --- 2) Fallback Open-Meteo (free, no key) → european AQI
    try {
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${data.lat}&longitude=${data.lng}&current=european_aqi,pm2_5`;
      const r = await fetch(url);
      if (r.ok) {
        const j: any = await r.json();
        const aqi = j?.current?.european_aqi ?? null;
        const pm25 = j?.current?.pm2_5 ?? null;
        let category = "—";
        if (aqi != null) {
          if (aqi < 20) category = "Ottima";
          else if (aqi < 40) category = "Buona";
          else if (aqi < 60) category = "Media";
          else if (aqi < 80) category = "Scarsa";
          else if (aqi < 100) category = "Scadente";
          else category = "Molto scadente";
        }
        // Normalizza alla scala "higher = better" (Google-like 0-100)
        const normalized = aqi != null ? Math.max(0, Math.min(100, 100 - aqi)) : null;
        return {
          aqi: normalized,
          pm25: pm25 != null ? Math.round(pm25 * 10) / 10 : null,
          category,
          source: "open-meteo" as const,
        };
      }
    } catch (e) {
      console.error("[airquality] open-meteo exception", e);
    }

    return { aqi: null, pm25: null, category: "—", source: "error" as const };
  });
