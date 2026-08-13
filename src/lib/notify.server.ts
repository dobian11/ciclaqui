/**
 * Layer unico di notifica Cicla Qui: in-app + push + email.
 * Server-only. Rispetta sempre le preferenze utente (notification_preferences):
 * `inapp_<topic>`, `push_<topic>`, `email_<topic>` (default: attivo).
 */
import { PUBLIC_APP_URL } from "@/lib/public-url";

export type NotifyTopic = "company" | "challenges" | "streak" | "bike" | "rewards" | "trip_flag";

export type NotifyInput = {
  userIds: string[];
  topic: NotifyTopic;
  /** Tipo tecnico salvato su user_notifications (es. "payout_paid"). */
  type: string;
  title: string;
  body: string;
  /** Percorso interno per il deep-link (es. "/app/punti"). */
  url?: string;
  companyId?: string | null;
  payload?: Record<string, unknown>;
  /** Righe di dettaglio mostrate nell'email. */
  details?: { label: string; value: string }[];
  /** Codice evidenziato nell'email (voucher, riferimento…). */
  code?: string;
  ctaLabel?: string;
  /** Salta l'inserimento in-app (quando lo fa già una funzione SQL). */
  skipInApp?: boolean;
  /** Salta l'email (solo in-app + push). */
  skipEmail?: boolean;
};

export type NotifyResult = {
  inApp: number;
  push: { configured: boolean; sent: number; failed: number; tokens: number; error?: string };
  emails: number;
};

/** Invia una notifica multicanale agli utenti indicati. Non lancia mai eccezioni. */
export async function notifyUsers(input: NotifyInput): Promise<NotifyResult> {
  const result: NotifyResult = {
    inApp: 0,
    push: { configured: false, sent: 0, failed: 0, tokens: 0 },
    emails: 0,
  };

  const userIds = [...new Set(input.userIds)].filter(Boolean);
  if (!userIds.length) return result;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };

    const { data: prefsRaw } = await db
      .from("notification_preferences")
      .select("*")
      .in("user_id", userIds);
    const prefs = new Map<string, Record<string, unknown>>(
      ((prefsRaw ?? []) as Record<string, unknown>[]).map((p) => [String(p.user_id), p]),
    );
    const allows = (uid: string, channel: "inapp" | "email") =>
      prefs.get(uid)?.[`${channel}_${input.topic}`] !== false;

    // ── In-app ────────────────────────────────────────────
    if (!input.skipInApp) {
      const rows = userIds
        .filter((uid) => allows(uid, "inapp"))
        .map((uid) => ({
          user_id: uid,
          company_id: input.companyId ?? null,
          type: input.type,
          title: input.title,
          body: input.body,
          payload: { ...(input.payload ?? {}), url: input.url ?? null },
        }));
      if (rows.length) {
        const { error } = await db.from("user_notifications").insert(rows);
        if (!error) result.inApp = rows.length;
      }
    }

    // ── Push ──────────────────────────────────────────────
    try {
      const { sendPushToUsers } = await import("@/lib/push.server");
      result.push = await sendPushToUsers({
        userIds,
        title: input.title,
        body: input.body,
        preferenceKey: `push_${input.topic}`,
        data: { type: input.type, url: input.url ?? "/app" },
      });
    } catch (e) {
      result.push = {
        configured: true,
        sent: 0,
        failed: 0,
        tokens: 0,
        error: e instanceof Error ? e.message : "Errore push",
      };
    }

    // ── Email ─────────────────────────────────────────────
    if (!input.skipEmail) {
      const { enqueueAppEmail } = await import("@/lib/email/enqueue.server");
      for (const uid of userIds) {
        if (!allows(uid, "email")) continue;
        let email: string | null = null;
        try {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
          email = u?.user?.email ?? null;
        } catch {
          email = null;
        }
        if (!email) continue;
        const res = await enqueueAppEmail({
          templateName: "app-notification",
          to: email,
          idempotencyKey: `${input.type}:${uid}:${input.payload?.["ref"] ?? input.title}`.slice(0, 180),
          templateData: {
            title: input.title,
            message: input.body,
            details: input.details ?? [],
            code: input.code,
            ctaLabel: input.ctaLabel ?? "Apri Cicla Qui",
            ctaUrl: `${PUBLIC_APP_URL}${input.url ?? "/app"}`,
          },
        });
        if (res.ok) result.emails++;
      }
    }
  } catch (e) {
    console.error("[notifyUsers]", e);
  }

  return result;
}

/** Utenti manager/titolari collegati a un ente (destinatari lato ente). */
export async function companyManagerIds(companyId: string): Promise<string[]> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };
    const ids = new Set<string>();
    const { data: company } = await db
      .from("companies")
      .select("created_by")
      .eq("id", companyId)
      .maybeSingle();
    if (company?.created_by) ids.add(company.created_by as string);

    const { data: members } = await db.from("profiles").select("id").eq("company_id", companyId);
    const memberIds = (members ?? []).map((m: { id: string }) => m.id);
    if (memberIds.length) {
      const { data: roles } = await db
        .from("user_roles")
        .select("user_id")
        .eq("role", "company_manager")
        .in("user_id", memberIds);
      for (const r of roles ?? []) ids.add(r.user_id as string);
    }
    return [...ids];
  } catch {
    return [];
  }
}
