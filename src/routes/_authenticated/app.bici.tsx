import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bike, Plus, QrCode, ShieldAlert, ShieldCheck, X, Copy, Share2, Wallet } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyBikes,
  createBike,
  reportStolen,
  markRecovered,
} from "@/lib/bikes.functions";
import { getGoogleWalletLink, getAppleWalletPass } from "@/lib/wallet.functions";

export const Route = createFileRoute("/_authenticated/app/bici")({
  component: BiciPage,
});

type BikeRow = Awaited<ReturnType<typeof listMyBikes>>[number];

function BiciPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyBikes);
  const [hasSession, setHasSession] = useState<boolean | null>(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
  }, []);

  const { data: bikes = [], isLoading } = useQuery({
    queryKey: ["my-bikes"],
    queryFn: () => listFn(),
    enabled: hasSession === true,
  });

  const [showAdd, setShowAdd] = useState(false);
  const [showQr, setShowQr] = useState<BikeRow | null>(null);

  if (hasSession === false) {
    return (
      <div className="h-full overflow-y-auto bg-background">
        <div className="mx-auto max-w-md px-5 py-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Le tue bici</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Accedi per registrare il passaporto delle tue bici.
          </p>
          <Link
            to="/auth"
            className="mt-6 inline-flex rounded-full bg-cicla px-5 py-2.5 text-sm font-semibold text-cicla-foreground"
          >
            Accedi
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background pb-32">
      <div className="mx-auto max-w-md px-5 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Passaporto bici</h1>
            <p className="mt-1 text-sm text-muted-foreground">QR, telaio, antifurto.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-cicla px-4 py-2 text-sm font-semibold text-cicla-foreground shadow-lg shadow-cicla/20"
          >
            <Plus size={16} /> Aggiungi
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {isLoading && (
            <div className="rounded-2xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
              Caricamento…
            </div>
          )}
          {!isLoading && bikes.length === 0 && (
            <div className="grid place-items-center rounded-3xl border border-dashed border-border bg-card/40 p-10 text-center">
              <div className="grid size-16 place-items-center rounded-full bg-cicla/10 text-cicla">
                <Bike size={28} />
              </div>
              <h2 className="mt-4 font-display text-lg font-semibold">Nessuna bici ancora</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Registra la tua prima bici con il codice del telaio.
              </p>
            </div>
          )}
          {bikes.map((b) => (
            <BikeCard
              key={b.id}
              bike={b}
              onShowQr={() => setShowQr(b)}
              onChange={() => qc.invalidateQueries({ queryKey: ["my-bikes"] })}
            />
          ))}
        </div>
      </div>

      {showAdd && (
        <AddBikeModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            qc.invalidateQueries({ queryKey: ["my-bikes"] });
          }}
        />
      )}
      {showQr && <QrModal bike={showQr} onClose={() => setShowQr(null)} />}
    </div>
  );
}

function BikeCard({
  bike,
  onShowQr,
  onChange,
}: {
  bike: BikeRow;
  onShowQr: () => void;
  onChange: () => void;
}) {
  const reportFn = useServerFn(reportStolen);
  const recoverFn = useServerFn(markRecovered);

  const reportMut = useMutation({
    mutationFn: async () => {
      let coords: { lat?: number; lng?: number } = {};
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }),
        );
        coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch {
        // ignore
      }
      return reportFn({ data: { bike_id: bike.id, ...coords } });
    },
    onSuccess: () => {
      toast.success("Furto segnalato. La bici è ora pubblica nel registro.");
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recoverMut = useMutation({
    mutationFn: () => recoverFn({ data: { bike_id: bike.id } }),
    onSuccess: () => {
      toast.success("Bici contrassegnata come recuperata");
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isStolen = bike.status === "rubata";

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isStolen
          ? "border-destructive/40 bg-destructive/5"
          : "border-border bg-card/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-semibold">{bike.marca}</h3>
            {bike.modello && (
              <span className="text-sm text-muted-foreground">· {bike.modello}</span>
            )}
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Telaio: <span className="text-foreground">{bike.frame_number}</span>
          </p>
          {bike.colore && (
            <p className="text-xs text-muted-foreground">Colore: {bike.colore}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            isStolen
              ? "bg-destructive/20 text-destructive"
              : "bg-cicla/15 text-cicla"
          }`}
        >
          {bike.status}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onShowQr}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold"
        >
          <QrCode size={14} /> QR passaporto
        </button>
        {isStolen ? (
          <button
            type="button"
            onClick={() => recoverMut.mutate()}
            disabled={recoverMut.isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-cicla/15 px-3 py-1.5 text-xs font-semibold text-cicla disabled:opacity-50"
          >
            <ShieldCheck size={14} /> Segna come recuperata
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (confirm("Segnalare questa bici come rubata? Sarà visibile pubblicamente.")) {
                reportMut.mutate();
              }
            }}
            disabled={reportMut.isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1.5 text-xs font-semibold text-destructive disabled:opacity-50"
          >
            <ShieldAlert size={14} /> Segnala furto
          </button>
        )}
      </div>
    </div>
  );
}

function AddBikeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const createFn = useServerFn(createBike);
  const [form, setForm] = useState({
    marca: "",
    modello: "",
    colore: "",
    frame_number: "",
  });
  const mut = useMutation({
    mutationFn: () => createFn({ data: form }),
    onSuccess: () => {
      toast.success("Bici registrata");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 backdrop-blur-sm sm:place-items-center">
      <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-6 sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Nuova bici</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
          className="mt-4 space-y-3"
        >
          <Field label="Marca *">
            <input
              required
              value={form.marca}
              onChange={(e) => setForm({ ...form, marca: e.target.value })}
              placeholder="Es. Bianchi"
              className="input-base"
            />
          </Field>
          <Field label="Modello">
            <input
              value={form.modello}
              onChange={(e) => setForm({ ...form, modello: e.target.value })}
              placeholder="Es. Aria"
              className="input-base"
            />
          </Field>
          <Field label="Colore">
            <input
              value={form.colore}
              onChange={(e) => setForm({ ...form, colore: e.target.value })}
              placeholder="Es. Verde celeste"
              className="input-base"
            />
          </Field>
          <Field label="Numero telaio *">
            <input
              required
              value={form.frame_number}
              onChange={(e) =>
                setForm({ ...form, frame_number: e.target.value.toUpperCase() })
              }
              placeholder="WBA12345678"
              className="input-base font-mono"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Stampigliato sul telaio (di solito sotto il movimento centrale).
            </p>
          </Field>
          <button
            type="submit"
            disabled={mut.isPending}
            className="mt-2 w-full rounded-full bg-cicla py-3 text-sm font-semibold text-cicla-foreground disabled:opacity-50"
          >
            {mut.isPending ? "Salvataggio…" : "Registra bici"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function QrModal({ bike, onClose }: { bike: BikeRow; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const passportUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/cerca-bici?telaio=${encodeURIComponent(bike.frame_number)}`
      : "";

  useEffect(() => {
    QRCode.toDataURL(passportUrl, { width: 512, margin: 1, color: { dark: "#0c0c0e", light: "#ffffff" } })
      .then(setDataUrl)
      .catch(() => null);
  }, [passportUrl]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Passaporto QR</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 grid place-items-center">
          {dataUrl ? (
            <img src={dataUrl} alt="QR passaporto" className="size-56 rounded-2xl bg-white p-3" />
          ) : (
            <div className="size-56 animate-pulse rounded-2xl bg-muted" />
          )}
        </div>
        <p className="mt-3 font-mono text-xs text-muted-foreground">{bike.frame_number}</p>
        <p className="mt-1 text-xs text-muted-foreground break-all">{passportUrl}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(passportUrl);
              toast.success("Link copiato");
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold"
          >
            <Copy size={14} /> Copia
          </button>
          <button
            onClick={async () => {
              if (navigator.share) {
                try {
                  await navigator.share({ url: passportUrl, title: "Passaporto Cicla Qui" });
                } catch {
                  /* ignore */
                }
              } else {
                navigator.clipboard.writeText(passportUrl);
                toast.success("Link copiato");
              }
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-cicla px-3 py-2 text-xs font-semibold text-cicla-foreground"
          >
            <Share2 size={14} /> Condividi
          </button>
        </div>
        <WalletButtons bikeId={bike.id} />
      </div>
    </div>
  );
}

function WalletButtons({ bikeId }: { bikeId: string }) {
  const googleFn = useServerFn(getGoogleWalletLink);
  const appleFn = useServerFn(getAppleWalletPass);
  const [loading, setLoading] = useState<"google" | "apple" | null>(null);

  async function onGoogle() {
    setLoading("google");
    try {
      const res = await googleFn({ data: { bike_id: bikeId } });
      if (!res.configured) {
        toast.info("Google Wallet non ancora configurato dall'admin.");
      } else {
        window.open(res.saveUrl, "_blank", "noopener");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore Google Wallet");
    } finally {
      setLoading(null);
    }
  }

  async function onApple() {
    setLoading("apple");
    try {
      const res = await appleFn({ data: { bike_id: bikeId } });
      if (!res.configured) {
        toast.info("Apple Wallet non ancora configurato dall'admin.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore Apple Wallet");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <button
        onClick={onApple}
        disabled={loading !== null}
        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-foreground/95 px-3 py-2 text-xs font-semibold text-background disabled:opacity-50"
      >
        <Wallet size={14} /> {loading === "apple" ? "…" : "Apple Wallet"}
      </button>
      <button
        onClick={onGoogle}
        disabled={loading !== null}
        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50"
      >
        <Wallet size={14} /> {loading === "google" ? "…" : "Google Wallet"}
      </button>
    </div>
  );
}
