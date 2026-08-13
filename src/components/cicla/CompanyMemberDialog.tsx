import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyEmployeeDetail } from "@/lib/admin.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bike, Footprints, Leaf, Flame, Trophy, Award, CalendarDays } from "lucide-react";

type Props = {
  userId: string | null;
  onOpenChange: (open: boolean) => void;
};

const MODE_LABEL: Record<string, string> = { bike: "Bici", foot: "A piedi", car: "Auto" };

export function CompanyMemberDialog({ userId, onOpenChange }: Props) {
  const detail = useServerFn(getMyEmployeeDetail);
  const { data, isLoading, error } = useQuery({
    queryKey: ["employee-detail", userId],
    queryFn: () => detail({ data: { user_id: userId! } }),
    enabled: !!userId,
    retry: false,
  });

  return (
    <Dialog open={!!userId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{data?.full_name ?? "Dettaglio membro"}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : error || !data ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Impossibile caricare i dettagli di questo membro.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-[12px] text-muted-foreground">
              Iscritto il {new Date(data.joined_at).toLocaleDateString("it-IT")} · streak attuale{" "}
              {data.streak.current_days} giorni (record {data.streak.best_days})
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat icon={<Bike className="size-4" />} label="Km in bici" value={`${data.totals.bike_km} km`} />
              <Stat icon={<Footprints className="size-4" />} label="Km a piedi" value={`${data.totals.foot_km} km`} />
              <Stat icon={<Leaf className="size-4" />} label="CO₂ risparmiata" value={`${data.totals.co2_saved_kg} kg`} />
              <Stat icon={<Flame className="size-4" />} label="Calorie" value={`${data.totals.calories}`} />
              <Stat icon={<CalendarDays className="size-4" />} label="Km ultimi 30gg" value={`${data.totals.km_last_30d} km`} />
              <Stat icon={<Trophy className="size-4" />} label="Viaggi totali" value={`${data.totals.trips}`} />
              <Stat icon={<Trophy className="size-4" />} label="Punti lifetime" value={`${data.wallet.lifetime_points}`} />
              <Stat icon={<Trophy className="size-4" />} label="Punti attuali" value={`${data.wallet.points_balance}`} />
            </div>

            <Card className="p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Badge ({data.badges.length})
              </div>
              {data.badges.length === 0 ? (
                <p className="mt-2 text-[12px] text-muted-foreground">Nessun badge assegnato.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.badges.map((b) => (
                    <Badge key={b.id} variant="secondary" className="gap-1">
                      <Award className="size-3" /> {b.title}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ultimi viaggi
              </div>
              {data.recent_trips.length === 0 ? (
                <p className="mt-2 text-[12px] text-muted-foreground">Nessun viaggio registrato.</p>
              ) : (
                <ul className="mt-2 divide-y divide-border/40">
                  {data.recent_trips.map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium">{MODE_LABEL[t.mode] ?? t.mode}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(t.started_at).toLocaleString("it-IT")}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{Number(t.distance_km).toFixed(2)} km</div>
                        <div className="text-[11px] text-cicla">+{t.points_earned} pt</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1 font-display text-lg font-bold">{value}</div>
    </Card>
  );
}
