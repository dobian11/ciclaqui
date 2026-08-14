import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isNativeApp } from "@/hooks/use-push";

type Remove = { remove: () => void };

/**
 * Listener push globali (solo app nativa):
 * - notifica in foreground → toast + refresh delle query
 * - tap sulla notifica → deep-link interno (data.url)
 */
export function usePushListeners() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isNativeApp()) return;
    let subs: Remove[] = [];
    let alive = true;

    (async () => {
      const mod = await import(/* @vite-ignore */ "@capacitor/push-notifications");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Push = (mod as any).PushNotifications;
      if (!alive) return;

      subs.push(
        await Push.addListener(
          "pushNotificationReceived",
          (n: { title?: string; body?: string }) => {
            if (n.title || n.body) toast(n.title ?? "Cicla Qui", { description: n.body });
            void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          },
        ),
      );

      subs.push(
        await Push.addListener(
          "pushNotificationActionPerformed",
          (a: { notification?: { data?: Record<string, string> } }) => {
            const url = a.notification?.data?.url;
            void queryClient.invalidateQueries({ queryKey: ["notifications"] });
            if (url && url.startsWith("/")) navigate({ to: url as never }).catch(() => undefined);
          },
        ),
      );
    })();

    return () => {
      alive = false;
      subs.forEach((s) => s.remove?.());
      subs = [];
    };
  }, [navigate, queryClient]);
}
