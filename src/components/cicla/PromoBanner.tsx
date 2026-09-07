import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPromoBanner, isPromoLive } from "@/lib/promo.functions";
import { Sparkles } from "lucide-react";

/** Banner promozionale mostrato agli enti quando l'admin lo attiva. */
export function PromoBanner() {
  const get = useServerFn(getPromoBanner);
  const { data } = useQuery({ queryKey: ["promo-banner"], queryFn: () => get({}), retry: false });

  if (!isPromoLive(data)) return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-cicla/40 bg-cicla/10 p-4">
      <Sparkles className="mt-0.5 size-5 shrink-0 text-cicla" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-cicla">{data!.title}</p>
        <p className="text-[12px] leading-snug text-muted-foreground">{data!.message}</p>
      </div>
    </div>
  );
}
