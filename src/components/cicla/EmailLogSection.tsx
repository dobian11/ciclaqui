import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCompanyEmailLog } from "@/lib/email-log.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MailCheck, MailX, Mail, BellRing, BellOff } from "lucide-react";

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : "—";
}

type Props = {
  /** Se assente: mostra tutti gli invii visibili (admin). */
  companyId?: string;
  showCompanyName?: boolean;
  title?: string;
};

/** Log invii email di decisione (esito riuscito/fallito), visibile ad admin ed enti. */
export function EmailLogSection({ companyId, showCompanyName = false, title = "Log invii notifiche" }: Props) {
  const listLog = useServerFn(listCompanyEmailLog);
  const { data, isLoading } = useQuery({
    queryKey: ["company-email-log", companyId ?? "all"],
    queryFn: () => listLog({ data: companyId ? { company_id: companyId } : {} }),
  });

  const rows = data ?? [];

  return (
    <Card className="mt-4 border-border/60 bg-card/70 p-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <Mail className="size-4 text-muted-foreground" />
        <h2 className="font-display text-sm font-bold">{title}</h2>
        {rows.length > 0 && (
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {rows.length}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-6">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Nessuna notifica di decisione inviata finora.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => {
            const ok = r.status === "sent";
            const isPush = r.channel === "push";
            return (
              <li
                key={r.id}
                className="rounded-xl border border-border/60 bg-secondary/40 px-3 py-2.5"
              >
                <div className="flex items-start gap-2">
                  {isPush ? (
                    ok ? (
                      <BellRing className="mt-0.5 size-4 shrink-0 text-cicla" />
                    ) : (
                      <BellOff className="mt-0.5 size-4 shrink-0 text-destructive" />
                    )
                  ) : ok ? (
                    <MailCheck className="mt-0.5 size-4 shrink-0 text-cicla" />
                  ) : (
                    <MailX className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold">
                        {r.decision === "approved" ? "Esito: approvato" : "Esito: rifiutato"}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {isPush ? "Push" : "Email"}
                      </Badge>
                      <Badge
                        className={
                          ok
                            ? "bg-cicla/15 text-cicla text-[10px]"
                            : "bg-destructive/15 text-destructive text-[10px]"
                        }
                      >
                        {ok ? "Inviata" : "Fallita"}
                      </Badge>
                    </div>
                    {showCompanyName && r.company_name && (
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {r.company_name}
                      </div>
                    )}
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {isPush ? "Dispositivi: " : "A: "}
                      {r.recipient_email}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{fmt(r.created_at)}</div>
                    {!ok && r.error_message && (
                      <div className="mt-1 rounded-lg bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                        {r.error_message}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
