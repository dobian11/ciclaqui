import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const createBikeSchema = z.object({
  marca: z.string().trim().min(1).max(80),
  modello: z.string().trim().max(80).optional().or(z.literal("")),
  colore: z.string().trim().max(40).optional().or(z.literal("")),
  frame_number: z.string().trim().min(3).max(40),
  photo_url: z.string().url().max(500).optional().or(z.literal("")),
});

export const listMyBikes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("bikes")
      .select("id, marca, modello, colore, frame_number, photo_url, status, qr_token, stolen_at, stolen_note, created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createBike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createBikeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const frame = data.frame_number.trim().toUpperCase();

    // Check unicità globale frame number
    const { data: existing } = await supabase
      .from("bikes")
      .select("id")
      .eq("frame_number", frame)
      .maybeSingle();
    if (existing) throw new Error("Questo numero di telaio è già registrato");

    const { data: bike, error } = await supabase
      .from("bikes")
      .insert({
        owner_id: userId,
        marca: data.marca,
        modello: data.modello || null,
        colore: data.colore || null,
        frame_number: frame,
        photo_url: data.photo_url || null,
      })
      .select()
      .single();
    if (error || !bike) throw new Error(error?.message ?? "Errore creazione bici");
    return bike;
  });

const reportStolenSchema = z.object({
  bike_id: z.string().uuid(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  note: z.string().trim().max(500).optional(),
});

export const reportStolen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reportStolenSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("bikes")
      .update({
        status: "rubata",
        stolen_at: new Date().toISOString(),
        stolen_lat: data.lat ?? null,
        stolen_lng: data.lng ?? null,
        stolen_note: data.note ?? null,
      })
      .eq("id", data.bike_id)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    await supabase.from("bike_reports").insert({
      bike_id: data.bike_id,
      reporter_id: userId,
      type: "sighting",
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      note: `[FURTO] ${data.note ?? ""}`.trim(),
    });
    return { ok: true };
  });

export const markRecovered = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bike_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("bikes")
      .update({ status: "recuperata", stolen_at: null })
      .eq("id", data.bike_id)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const lookupSchema = z.object({
  query: z.string().trim().min(3).max(40),
});

/** Ricerca pubblica per numero di telaio: ritorna solo bici segnalate rubate. */
export const lookupStolenBike = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => lookupSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const frame = data.query.trim().toUpperCase();
    const { data: bike } = await supabaseAdmin
      .from("bikes")
      .select("id, marca, modello, colore, frame_number, photo_url, status, stolen_at, stolen_lat, stolen_lng, stolen_note")
      .eq("frame_number", frame)
      .eq("status", "rubata")
      .maybeSingle();
    if (!bike) return null;
    return bike;
  });

const sightingSchema = z.object({
  bike_id: z.string().uuid(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  note: z.string().trim().min(3).max(500),
});

/** Chiunque (anche anonimo) può segnalare l'avvistamento di una bici rubata. */
export const addSighting = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => sightingSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Verifica che la bici sia effettivamente rubata
    const { data: bike } = await supabaseAdmin
      .from("bikes")
      .select("id, status")
      .eq("id", data.bike_id)
      .maybeSingle();
    if (!bike || bike.status !== "rubata") {
      throw new Error("Bici non trovata o non risulta rubata");
    }
    const { error } = await supabaseAdmin.from("bike_reports").insert({
      bike_id: data.bike_id,
      type: "sighting",
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      note: data.note,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
