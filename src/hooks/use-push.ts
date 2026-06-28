import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Push registration. In nativo usa @capacitor/push-notifications + FCM.
 * Su web ritorna `unsupported: true` (Web Push richiede VAPID, prossimo sprint).
 */
export function usePush() {
  const [status, setStatus] = useState<"idle" | "registering" | "registered" | "denied" | "error" | "unsupported">("idle");

  const register = useCallback(async () => {
    setStatus("registering");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Cap = (typeof window !== "undefined" ? (window as any).Capacitor : null);
      if (!Cap?.isNativePlatform?.()) {
        setStatus("unsupported");
        return { unsupported: true as const };
      }
      const pushMod = await import(/* @vite-ignore */ "@capacitor/push-notifications");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const PushNotifications = (pushMod as any).PushNotifications;
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== "granted") {
        setStatus("denied");
        return { denied: true as const };
      }
      await PushNotifications.register();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const token = await new Promise<string>((resolve) => {
        PushNotifications.addListener("registration", (t: { value: string }) => resolve(t.value));
      });
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("device_tokens").upsert({
          user_id: user.id,
          token,
          platform: Cap.getPlatform?.() ?? "unknown",
          last_seen: new Date().toISOString(),
        }, { onConflict: "user_id,token" });
      }
      setStatus("registered");
      return { token };
    } catch (e) {
      console.error(e);
      setStatus("error");
      return { error: String(e) };
    }
  }, []);

  return { status, register };
}
