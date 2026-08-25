/**
 * Test di sicurezza RLS per public.trip_flags e public.trip_flags_audit.
 *
 * Gira contro il backend configurato in .env (VITE_SUPABASE_URL /
 * VITE_SUPABASE_PUBLISHABLE_KEY) usando SOLO chiavi pubbliche: nessun dato
 * viene mai scritto con successo — ogni tentativo di scrittura DEVE fallire
 * o non avere effetto grazie a RLS.
 *
 * Stato atteso delle policy (verificato via SQL il 2026-08-25):
 * - trip_flags: RLS attiva. INSERT solo admin; UPDATE solo admin/manager
 *   dell'ente; SELECT solo proprietario/admin/manager dell'ente; DELETE
 *   negato a tutti (nessuna policy).
 * - trip_flags_audit: RLS attiva. SELECT solo admin/manager dell'ente;
 *   nessuna policy di scrittura (scrive solo il trigger di sistema).
 *
 * I test "utente autenticato" vengono saltati a meno che non siano
 * valorizzate TRIP_FLAGS_TEST_EMAIL e TRIP_FLAGS_TEST_PASSWORD con un
 * account di prova SENZA ruoli admin/company_manager.
 *
 * Esecuzione: bunx vitest run src/lib/trip-flags-rls.test.ts
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const TEST_EMAIL = process.env.TRIP_FLAGS_TEST_EMAIL;
const TEST_PASSWORD = process.env.TRIP_FLAGS_TEST_PASSWORD;

const FAKE_ID = "00000000-0000-0000-0000-000000000000";
const FLAGS = "trip_flags";
const AUDIT = "trip_flags_audit";

function makeClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const describeIfConfigured = SUPABASE_URL && SUPABASE_KEY ? describe : describe.skip;

describeIfConfigured("RLS trip_flags — accesso anonimo", () => {
  const anon = makeClient();

  it("non espone nessuna segnalazione in lettura", async () => {
    const { data, error } = await anon.from(FLAGS).select("id").limit(5);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("non può creare segnalazioni", async () => {
    const { error } = await anon.from(FLAGS).insert({
      trip_id: FAKE_ID,
      user_id: FAKE_ID,
      score: 0.9,
      declared_mode: "bike",
      predicted_mode: "car",
      status: "pending",
    });
    expect(error).toBeTruthy();
  });

  it("non può modificare segnalazioni", async () => {
    const { data, error } = await anon
      .from(FLAGS)
      .update({ status: "dismissed" })
      .eq("id", FAKE_ID)
      .select();
    expect(error ?? null).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("non può eliminare segnalazioni", async () => {
    const { data, error } = await anon.from(FLAGS).delete().eq("id", FAKE_ID).select();
    expect(error ?? null).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("non vede il registro di audit", async () => {
    const { data, error } = await anon.from(AUDIT).select("id").limit(1);
    // Senza GRANT: errore di permesso. Con GRANT ma senza policy: zero righe.
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});

const describeWithUser = TEST_EMAIL && TEST_PASSWORD ? describe : describe.skip;

describeWithUser("RLS trip_flags — utente autenticato senza ruoli", () => {
  let client: SupabaseClient;
  let myId: string;

  beforeAll(async () => {
    client = makeClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: TEST_EMAIL!,
      password: TEST_PASSWORD!,
    });
    if (error || !data.user) throw new Error(`Login utente di test fallito: ${error?.message}`);
    myId = data.user.id;
  });

  it("vede solo le proprie segnalazioni", async () => {
    const { data, error } = await client.from(FLAGS).select("user_id").limit(50);
    expect(error).toBeNull();
    for (const row of data ?? []) {
      expect(row.user_id).toBe(myId);
    }
  });

  it("non può creare segnalazioni (solo admin/pipeline)", async () => {
    const { error } = await client.from(FLAGS).insert({
      trip_id: FAKE_ID,
      user_id: myId,
      score: 0.9,
      declared_mode: "bike",
      predicted_mode: "car",
      status: "pending",
    });
    expect(error).toBeTruthy();
  });

  it("non può modificare lo stato delle proprie segnalazioni", async () => {
    const { data, error } = await client
      .from(FLAGS)
      .update({ status: "dismissed" })
      .eq("user_id", myId)
      .select();
    expect(error ?? null).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("non può eliminare le proprie segnalazioni", async () => {
    const { data: before } = await client.from(FLAGS).select("id").eq("user_id", myId);
    await client.from(FLAGS).delete().eq("user_id", myId);
    const { data: after } = await client.from(FLAGS).select("id").eq("user_id", myId);
    expect(after ?? []).toHaveLength((before ?? []).length);
  });

  it("non vede il registro di audit", async () => {
    const { data, error } = await client.from(AUDIT).select("id").limit(5);
    expect(error ?? null).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("non può scrivere nel registro di audit", async () => {
    const { error } = await client.from(AUDIT).insert({
      trip_flag_id: FAKE_ID,
      action: "insert",
    });
    expect(error).toBeTruthy();
  });
});
