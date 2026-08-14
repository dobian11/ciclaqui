import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PushStatus =
  | "idle"
  | "registering"
  | "registered"
  | "denied"
  | "error"
  | "unsupported";

type NativePush = {
  requestPermissions: () => Promise<{ receive: string }>;
  checkPermissions: () => Promise<{ receive: string }>;
  register: () => Promise<void>;
  addListener: (event: string, cb: (arg: unknown) => void) => Promise<{ remove: () => void }>;
  removeAllListeners: () => Promise<void>;
  createChannel?: (c: Record<string, unknown>) => Promise<void>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cap(): any | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (window as any).Capacitor;
  return c?.isNativePlatform?.() ? c : null;
}

export function isNativeApp() {
  return Boolean(cap());
}

async function loadPush(): Promise<NativePush | null> {
  if (!cap()) return null;
  const mod = await import(/* @vite-ignore */ "@capacitor/push-notifications");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (mod as any).PushNotifications as NativePush;
}

async function saveToken(token: string, platform: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("device_tokens").upsert(
    {
      user_id: user.id,
      token,
      platform,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "user_id,token" },
  );
}

/**
 * Registrazione push FCM (Android + iOS via APNs).
 * Su web ritorna `unsupported`: le notifiche restano in-app + email.
 */
export function usePush() {
  const [status, setStatus] = useState<PushStatus>("idle");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  const register = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (running.current) return { pending: true as const };
      running.current = true;
      setError(null);
      setStatus("registering");
      try {
        const Cap = cap();
        const Push = await loadPush();
        if (!Cap || !Push) {
          setStatus("unsupported");
          return { unsupported: true as const };
        }

        const current = await Push.checkPermissions();
        let receive = current.receive;
        if (receive !== "granted") {
          if (opts?.silent && receive === "denied") {
            setStatus("denied");
            return { denied: true as const };
          }
          receive = (await Push.requestPermissions()).receive;
        }
        if (receive !== "granted") {
          setStatus("denied");
          return { denied: true as const };
        }

        // Canale Android per notifiche ad alta priorità
        await Push.createChannel?.({
          id: "cicla_default",
          name: "Cicla Qui",
          description: "Avvisi su punti, premi, sfide e bici",
          importance: 5,
          visibility: 1,
        }).catch(() => undefined);

        const platform = Cap.getPlatform?.() ?? "unknown";

        const got = new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Timeout registrazione push")), 20000);
          void Push.addListener("registration", (t) => {
            clearTimeout(timeout);
            resolve((t as { value: string }).value);
          });
          void Push.addListener("registrationError", (e) => {
            clearTimeout(timeout);
            reject(new Error(JSON.stringify(e)));
          });
        });

        await Push.register();
        const value = await got;
        await saveToken(value, platform);
        setToken(value);
        setStatus("registered");
        return { token: value };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[push]", msg);
        setError(msg);
        setStatus("error");
        return { error: msg };
      } finally {
        running.current = false;
      }
    },
    [],
  );

  // Stato iniziale senza chiedere permessi
  useEffect(() => {
    let alive = true;
    (async () => {
      const Push = await loadPush();
      if (!alive) return;
      if (!Push) {
        setStatus("unsupported");
        return;
      }
      const perm = await Push.checkPermissions().catch(() => null);
      if (!alive || !perm) return;
      if (perm.receive === "granted") setStatus("registered");
      else if (perm.receive === "denied") setStatus("denied");
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { status, token, error, register, isNative: isNativeApp() };
}
