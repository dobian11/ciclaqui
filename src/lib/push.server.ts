/**
 * Invio push FCM HTTP v1 (Android + iOS via APNs bridge di Firebase).
 * Server-only: usa il service account (secret FCM_SERVICE_ACCOUNT_JSON) e il client admin.
 *
 * Se il secret non è configurato ritorna { configured: false } e il chiamante
 * resta coperto dal fallback email + notifica in-app.
 */

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

export type PushResult = {
  configured: boolean;
  sent: number;
  failed: number;
  tokens: number;
  error?: string;
};

function b64url(input: ArrayBuffer | string) {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(sa: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key.replace(/\\n/g, "\n")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claim}`),
  );
  const jwt = `${header}.${claim}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`OAuth FCM ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

/** Invia una notifica push a tutti i device registrati degli utenti indicati. */
export async function sendPushToUsers(input: {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Colonna di notification_preferences da rispettare (es. "push_company"). */
  preferenceKey?: string;
}): Promise<PushResult> {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return { configured: false, sent: 0, failed: 0, tokens: 0 };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let userIds = [...new Set(input.userIds)].filter(Boolean);
  if (!userIds.length) return { configured: true, sent: 0, failed: 0, tokens: 0 };

  // Rispetta le preferenze push dell'utente (default: attivo se non ha una riga).
  if (input.preferenceKey) {
    const { data: prefs } = await supabaseAdmin
      .from("notification_preferences")
      .select(`user_id, ${input.preferenceKey}`)
      .in("user_id", userIds);
    const optedOut = new Set(
      (prefs ?? [])
        .filter((p) => (p as Record<string, unknown>)[input.preferenceKey!] === false)
        .map((p) => (p as { user_id: string }).user_id),
    );
    userIds = userIds.filter((id) => !optedOut.has(id));
    if (!userIds.length) return { configured: true, sent: 0, failed: 0, tokens: 0 };
  }

  const { data: tokens } = await supabaseAdmin
    .from("device_tokens")
    .select("token, platform")
    .in("user_id", userIds);

  if (!tokens?.length) return { configured: true, sent: 0, failed: 0, tokens: 0 };

  let sa: ServiceAccount;
  try {
    sa = JSON.parse(raw) as ServiceAccount;
  } catch {
    return { configured: true, sent: 0, failed: 0, tokens: tokens.length, error: "Service account FCM non valido" };
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken(sa);
  } catch (e) {
    return {
      configured: true,
      sent: 0,
      failed: tokens.length,
      tokens: tokens.length,
      error: e instanceof Error ? e.message : "Autenticazione FCM fallita",
    };
  }

  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  let sent = 0;
  let failed = 0;
  let lastError: string | undefined;
  const stale: string[] = [];

  for (const t of tokens) {
    const message = {
      message: {
        token: t.token,
        notification: { title: input.title, body: input.body },
        data: input.data ?? {},
        android: { priority: "HIGH", notification: { sound: "default" } },
        apns: {
          headers: { "apns-priority": "10" },
          payload: { aps: { sound: "default", badge: 1 } },
        },
      },
    };
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });
      if (res.ok) {
        sent++;
      } else {
        failed++;
        const txt = (await res.text()).slice(0, 300);
        lastError = `FCM ${res.status}: ${txt}`;
        if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/i.test(txt)) stale.push(t.token);
      }
    } catch (e) {
      failed++;
      lastError = e instanceof Error ? e.message : "Errore rete FCM";
    }
  }

  if (stale.length) {
    await supabaseAdmin.from("device_tokens").delete().in("token", stale);
  }

  return { configured: true, sent, failed, tokens: tokens.length, error: lastError };
}
