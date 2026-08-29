/** Dicitura di branding partner, mostrata sotto il marchio Cicla Qui. */
export function PoweredBy({ className = "" }: { className?: string }) {
  return (
    <p
      className={`text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80 ${className}`}
    >
      Powered by <span className="text-cicla">Doctorbike Italia</span>
    </p>
  );
}
