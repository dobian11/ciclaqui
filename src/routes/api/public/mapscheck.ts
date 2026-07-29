import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/mapscheck")({
  server: {
    handlers: {
      GET: async () => {
        const key = process.env.GOOGLE_API_KEY;
        if (!key) return Response.json({ ok: false, error: "GOOGLE_API_KEY mancante" });
        const out: Record<string, string> = {};
        for (const referer of ["https://ciclaqui.it/", "https://www.ciclaqui.it/"]) {
          const res = await fetch(
            `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`,
            { headers: { Referer: referer } },
          );
          const text = (await res.text()).slice(0, 400).replace(/\s+/g, " ");
          out[referer] = `${res.status} :: ${text}`;
        }
        return Response.json({ ok: true, out });
      },
    },
  },
});
