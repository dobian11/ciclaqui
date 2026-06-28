import { Bike } from "lucide-react";

export function CiclaLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: { icon: 18, text: "text-base", pad: "h-8 w-8" },
    md: { icon: 22, text: "text-xl", pad: "h-10 w-10" },
    lg: { icon: 28, text: "text-2xl", pad: "h-12 w-12" },
  } as const;
  const s = sizes[size];
  return (
    <div className="inline-flex items-center gap-2">
      <div
        className={`${s.pad} grid place-items-center rounded-full bg-cicla text-cicla-foreground shadow-cicla`}
      >
        <Bike size={s.icon} strokeWidth={2.4} />
      </div>
      <div className="leading-tight">
        <div className={`font-display font-bold tracking-tight ${s.text}`}>
          CICLA<span className="text-cicla">QUI</span>
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          la tua sicurezza in bici
        </div>
      </div>
    </div>
  );
}
