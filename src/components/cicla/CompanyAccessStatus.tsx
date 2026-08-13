import { Card } from "@/components/ui/card";
import { CheckCircle2, Clock, XCircle, HelpCircle, CreditCard } from "lucide-react";

type Status = "pending" | "approved" | "rejected" | string;

interface Props {
  status: Status;
  /** Abbonamento attivo o in prova */
  subActive: boolean;
  rejectionReason?: string | null;
  isMuni?: boolean;
}

/**
 * Messaggio di stato accesso per l'area ente: spiega se l'accesso è
 * confermato o bloccato e cosa fare in caso di problemi di login.
 */
export function CompanyAccessStatus({ status, subActive, rejectionReason, isMuni }: Props) {
  const members = isMuni ? "cittadini" : "dipendenti";

  const config =
    status === "rejected"
      ? {
          tone: "border-destructive/40 bg-destructive/10",
          iconTone: "text-destructive",
          Icon: XCircle,
          title: "Accesso bloccato — richiesta non approvata",
          body:
            rejectionReason?.trim()
              ? `Motivo indicato dall'admin: ${rejectionReason.trim()}`
              : "L'admin non ha specificato un motivo. Aggiorna i dati e i documenti, poi invia una nuova richiesta di revisione.",
        }
      : status !== "approved"
        ? {
            tone: "border-amber-500/40 bg-amber-500/10",
            iconTone: "text-amber-500",
            Icon: Clock,
            title: "Accesso limitato — verifica in corso",
            body:
              "Puoi entrare nel pannello e caricare i documenti, ma il codice ente e la distribuzione ai " +
              members +
              " restano bloccati finché l'admin non approva (24–48h).",
          }
        : !subActive
          ? {
              tone: "border-amber-500/40 bg-amber-500/10",
              iconTone: "text-amber-500",
              Icon: CreditCard,
              title: "Ente approvato — manca l'abbonamento",
              body:
                "L'accesso è confermato. Attiva l'abbonamento per sbloccare il codice ente e iniziare a distribuirlo ai " +
                members +
                ".",
            }
          : {
              tone: "border-cicla/40 bg-cicla/10",
              iconTone: "text-cicla",
              Icon: CheckCircle2,
              title: "Accesso confermato",
              body:
                "Il tuo ente è attivo: il codice è operativo e puoi distribuirlo ai " + members + ".",
            };

  const { Icon } = config;

  return (
    <Card className={`mt-4 border p-4 ${config.tone}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 size-4 shrink-0 ${config.iconTone}`} />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold">{config.title}</p>
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{config.body}</p>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-3 border-t border-border/50 pt-3">
        <HelpCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-[11px] leading-snug text-muted-foreground">
          Non riesci a entrare? Usa sempre l'email del referente indicata in registrazione.
          Se la password non funziona, apri{" "}
          <a href="/azienda/auth" className="font-semibold text-cicla underline-offset-2 hover:underline">
            la schermata di accesso
          </a>{" "}
          e tocca "Password dimenticata?": ricevi subito un link per impostarne una nuova.
          Se l'email di conferma non è mai arrivata, controlla lo spam e poi scrivici da questa pagina.
        </p>
      </div>
    </Card>
  );
}
