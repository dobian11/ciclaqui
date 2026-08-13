import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMyNotifications } from "@/lib/notifications.functions";
import { NotificationsSection } from "@/components/cicla/NotificationsSection";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell } from "lucide-react";

/**
 * Campanella notifiche da header: mostra il contatore delle non lette e apre
 * il centro notifiche in un popover, così la dashboard resta pulita.
 */
export function NotificationsBell({ className = "" }: { className?: string }) {
  const list = useServerFn(listMyNotifications);

  const { data: unread } = useQuery({
    queryKey: ["my-notifications", "unread-count"],
    queryFn: () => list({ data: { onlyUnread: true } }).then((r) => r.length),
    retry: false,
    refetchInterval: 60_000,
  });

  const count = unread ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={count > 0 ? `Notifiche, ${count} non lette` : "Notifiche"}
          className={`relative grid size-8 place-items-center rounded-full border border-border bg-background text-muted-foreground transition hover:bg-secondary/60 ${className}`}
        >
          <Bell className="size-4" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-cicla px-1 text-[9px] font-bold leading-4 text-cicla-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto p-3"
      >
        <NotificationsSection alwaysShow embedded />
      </PopoverContent>
    </Popover>
  );
}
