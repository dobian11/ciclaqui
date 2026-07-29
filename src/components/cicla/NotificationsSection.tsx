import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listMyNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/notifications.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Check, CheckCheck, AlertTriangle } from "lucide-react";

/**
 * Centro notifiche in-app: mostra gli esiti delle verifiche dell'ente
 * (approvazione / rifiuto) con data, motivazione e prossimo passo.
 */
export function NotificationsSection() {
  const list = useServerFn(listMyNotifications);
  const markOne = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["my-notifications"],
    queryFn: () => list({}),
    retry: false,
    refetchInterval: 60_000,
  });

  if (!data || data.length === 0) return null;
  const unread = data.filter((n) => !n.read_at).length;

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["my-notifications"] });
  }

  return (
    <Card className="mt-4 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Bell className="size-4" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Notifiche</span>
          {unread > 0 && (
            <Badge variant="secondary" className="bg-cicla/15 text-[10px] text-cicla">
              {unread} nuove
            </Badge>
          )}
        </div>
        {unread > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            onClick={async () => { await markAll({}); await refresh(); }}
          >
            <CheckCheck className="mr-1 size-3.5" /> Segna lette
          </Button>
        )}
      </div>

      <ul className="mt-3 space-y-2">
        {data.map((n) => {
          const payload = (n.payload ?? {}) as {
            decision?: string;
            decided_at?: string;
            reason?: string | null;
            next_step?: string;
            code?: string | null;
          };
          const rejected = payload.decision === "rejected" || n.type === "company_rejected";
          const when = payload.decided_at ?? n.created_at;
          return (
            <li
              key={n.id}
              className={`rounded-md border p-3 ${
                n.read_at ? "border-border/50" : rejected
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-cicla/40 bg-cicla/5"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {rejected ? (
                    <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
                  ) : (
                    <Check className="size-3.5 shrink-0 text-cicla" />
                  )}
                  <span className="text-[13px] font-semibold leading-snug">{n.title}</span>
                </div>
                {!n.read_at && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 shrink-0 px-2 text-[10px]"
                    onClick={async () => { await markOne({ data: { id: n.id } }); await refresh(); }}
                  >
                    Segna letta
                  </Button>
                )}
              </div>

              <div className="mt-1 text-[10px] text-muted-foreground">
                {new Date(when).toLocaleString("it-IT")}
              </div>

              {rejected && payload.reason && (
                <div className="mt-2 rounded bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                  Motivazione: {payload.reason}
                </div>
              )}

              {payload.next_step ? (
                <div className="mt-2 rounded bg-secondary/60 px-2 py-1.5 text-[11px] leading-snug">
                  <span className="font-semibold">Prossimo passo: </span>
                  {payload.next_step}
                </div>
              ) : (
                n.body && <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{n.body}</p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
