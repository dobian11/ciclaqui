/**
 * Fallback client-side per la qualità dell'aria (Open-Meteo, senza API key).
 * Usato quando la server function non è raggiungibile (rete instabile, cold start, 500).
 */
export type AirQualityResult = {
  aqi: number | null;
  pm25: number | null;
  category: string;
  source: "google" | "open-meteo" | "open-meteo-client" | "error";
};

function categoryFor(aqi: number): string {
  if (aqi < 20) return "Ottima";
  if (aqi < 40) return "Buona";
  if (aqi < 60) return "Media";
  if (aqi < 80) return "Scarsa";
  if (aqi < 100) return "Scadente";
  return "Molto scadente";
}

export async function fetchAirQualityFallback(lat: number, lng: number): Promise<AirQualityResult> {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=european_aqi,pm2_5`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error("Servizio qualità aria non raggiungibile");
  const json: any = await res.json();
  const eaqi = json?.current?.european_aqi ?? null;
  const pm25 = json?.current?.pm2_5 ?? null;
  if (eaqi == null) throw new Error("Dati qualità aria non disponibili");
  return {
    // scala normalizzata "più alto = meglio", coerente con la server function
    aqi: Math.max(0, Math.min(100, 100 - eaqi)),
    pm25: pm25 != null ? Math.round(pm25 * 10) / 10 : null,
    category: categoryFor(eaqi),
    source: "open-meteo-client",
  };
}
