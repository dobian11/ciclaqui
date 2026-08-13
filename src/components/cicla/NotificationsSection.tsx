import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listMyNotifications,
  markAllNotificationsRead,
  setNotificationRead,
} from "@/lib/notifications.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Check, CheckCheck, AlertTriangle, Dot, Undo2 } from "lucide-react";

/**
 * Centro notifiche in-app: mostra gli esiti delle verifiche dell'ente
 * (approvazione / rifiuto) con data, motivazione e prossimo passo.
 * Supporta stato letto/non letto e filtro "solo non lette".
 */
export function NotificationsSection({
  alwaysShow = false,
  embedded = false,
}: {
  alwaysShow?: boolean;
  embedded?: boolean;
}) {
  const list = useServerFn(listMyNotifications);
  const setRead = useServerFn(setNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const qc = useQueryClient();
  const [onlyUnread, setOnlyUnread] = useState(false);

  const { data } = useQuery({
    queryKey: ["my-notifications", onlyUnread],
    queryFn: () => list({ data: { onlyUnread } }),
    retry: false,
    refetchInterval: 60_000,
  });

  const { data: counts } = useQuery({
    queryKey: ["my-notifications", "unread-count"],
    queryFn: () => list({ data: { onlyUnread: true } }).then((r) => r.length),
    retry: false,
    refetchInterval: 60_000,
  });

  const unread = counts ?? 0;
  const items = data ?? [];

  if (!alwaysShow && items.length === 0 && !onlyUnread) return null;

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
              {unread} non lette
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
            <CheckCheck className="mr-1 size-3.5" /> Segna tutte lette
          </Button>
        )}
      </div>

      <div className="mt-3 flex gap-1 rounded-full bg-secondary/50 p-1">
        <button
          type="button"
          aria-pressed={!onlyUnread}
          onClick={() => setOnlyUnread(false)}
          className={`flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
            !onlyUnread ? "bg-cicla text-cicla-foreground" : "text-muted-foreground"
          }`}
        >
          Tutte
        </button>
        <button
          type="button"
          aria-pressed={onlyUnread}
          onClick={() => setOnlyUnread(true)}
          className={`flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
            onlyUnread ? "bg-cicla text-cicla-foreground" : "text-muted-foreground"
          }`}
        >
          Solo non lette{unread > 0 ? ` (${unread})` : ""}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          {onlyUnread ? "Nessuna notifica non letta." : "Nessuna notifica per ora."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((n) => {
            const payload = (n.payload ?? {}) as {
              decision?: string;
              decided_at?: string;
              reason?: string | null;
              next_step?: string;
              code?: string | null;
            };
            const rejected = payload.decision === "rejected" || n.type === "company_rejected";
            const when = payload.decided_at ?? n.created_at;
            const isRead = Boolean(n.read_at);
            return (
              <li
                key={n.id}
                className={`rounded-md border p-3 ${
                  isRead
                    ? "border-border/50 opacity-70"
                    : rejected
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
                    {!isRead && <Dot className="-ml-1 size-5 shrink-0 text-cicla" />}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 shrink-0 px-2 text-[10px]"
                    onClick={async () => {
                      await setRead({ data: { id: n.id, read: !isRead } });
                      await refresh();
                    }}
                  >
                    {isRead ? (
                      <><Undo2 className="mr-1 size-3" /> Non letta</>
                    ) : (
                      "Segna letta"
                    )}
                  </Button>
                </div>

                <div className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(when).toLocaleString("it-IT")}
                  {isRead && n.read_at ? ` · letta il ${new Date(n.read_at).toLocaleDateString("it-IT")}` : ""}
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
      )}
    </Card>
  );
}
