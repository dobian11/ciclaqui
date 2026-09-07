import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPromoBanner, adminUpdatePromoBanner } from "@/lib/promo.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Attivazione/disattivazione del banner promozionale per gli enti. */
export function AdminPromoBanner() {
  const qc = useQueryClient();
  const get = useServerFn(getPromoBanner);
  const update = useServerFn(adminUpdatePromoBanner);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["promo-banner"],
    queryFn: () => get({}),
    retry: false,
  });

  const [form, setForm] = useState({
    active: false,
    title: "",
    message: "",
    percent_off: 10,
    ends_at: "",
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      active: data.active,
      title: data.title,
      message: data.message,
      percent_off: data.percent_off,
      ends_at: toLocalInput(data.ends_at),
    });
  }, [data]);

  async function save(next?: Partial<typeof form>) {
    const payload = { ...form, ...next };
    setSaving(true);
    try {
      await update({
        data: {
          active: payload.active,
          title: payload.title.trim(),
          message: payload.message.trim(),
          percent_off: Number(payload.percent_off),
          ends_at: new Date(payload.ends_at).toISOString(),
        },
      });
      setForm(payload);
      toast.success(payload.active ? "Promo attiva" : "Promo disattivata");
      await qc.invalidateQueries({ queryKey: ["promo-banner"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-cicla" />
          <div>
            <div className="text-sm font-semibold">Banner promozione abbonamenti</div>
            <p className="text-[12px] text-muted-foreground">
              Se attivo, gli enti vedono il messaggio e lo sconto viene applicato al pagamento.
            </p>
          </div>
        </div>
        <Switch
          checked={form.active}
          disabled={saving}
          onCheckedChange={(v) => save({ active: v })}
          aria-label="Attiva promo"
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="promo-title" className="text-xs">Titolo</Label>
          <Input
            id="promo-title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            maxLength={120}
          />
        </div>
        <div>
          <Label htmlFor="promo-percent" className="text-xs">Sconto (%)</Label>
          <Input
            id="promo-percent"
            type="number"
            min={0}
            max={100}
            value={form.percent_off}
            onChange={(e) => setForm({ ...form, percent_off: Number(e.target.value) })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="promo-message" className="text-xs">Messaggio</Label>
          <Textarea
            id="promo-message"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            maxLength={300}
            rows={2}
          />
        </div>
        <div>
          <Label htmlFor="promo-end" className="text-xs">Valida fino al</Label>
          <Input
            id="promo-end"
            type="datetime-local"
            value={form.ends_at}
            onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
          />
        </div>
      </div>

      <Button className="mt-4" onClick={() => save()} disabled={saving}>
        {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        Salva promozione
      </Button>
    </Card>
  );
}
