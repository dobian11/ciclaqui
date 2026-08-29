import { Bike } from "lucide-react";

type Size = "sm" | "md" | "lg";

/**
 * Logo responsive: su schermi molto stretti l'icona si riduce e il payoff
 * viene nascosto per evitare compressioni/overflow dell'header.
 */
export function CiclaLogo({
  size = "md",
  showTagline = true,
  showPoweredBy = true,
  className = "",
}: {
  size?: Size;
  showTagline?: boolean;
  /** Dicitura "Powered by Doctorbike Italia" sotto il marchio. */
  showPoweredBy?: boolean;
  className?: string;
}) {
  const sizes = {
    sm: {
      icon: "size-4",
      text: "text-sm sm:text-base",
      pad: "h-7 w-7 sm:h-8 sm:w-8",
    },
    md: {
      icon: "size-4 sm:size-5",
      text: "text-base sm:text-xl",
      pad: "h-8 w-8 sm:h-10 sm:w-10",
    },
    lg: {
      icon: "size-5 sm:size-7",
      text: "text-lg sm:text-2xl",
      pad: "h-10 w-10 sm:h-12 sm:w-12",
    },
  } as const;
  const s = sizes[size];

  return (
    <div className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <div
        className={`${s.pad} shrink-0 grid place-items-center rounded-full bg-cicla text-cicla-foreground shadow-cicla`}
      >
        <Bike className={s.icon} strokeWidth={2.4} />
      </div>
      <div className="min-w-0 leading-tight">
        <div
          className={`truncate font-display font-bold tracking-tight ${s.text}`}
        >
          CICLA<span className="text-cicla">QUI</span>
        </div>
        {showTagline ? (
          <div className="hidden truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground xs:block">
            mobilità sostenibile, misurabile
          </div>
        ) : null}
        {showPoweredBy ? (
          <div className="truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
            Powered by <span className="text-cicla">Doctorbike Italia</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
