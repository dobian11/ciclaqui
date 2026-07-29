import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CiclaLogo } from "@/components/cicla/CiclaLogo";
import {
  Building2,
  Camera,
  Gift,
  KeyRound,
  Landmark,
  LogOut,
  Save,
  Shield,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { validateIban, formatIban } from "@/lib/iban";


export const Route = createFileRoute("/_authenticated/app/profilo")({
  component: ProfiloPage,
});

function ProfiloPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [weight, setWeight] = useState<string>("");
  const [iban, setIban] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState("");

  const profileQ = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("not signed in");
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, weight_kg, company_id, avatar_url, iban")
          .eq("id", user.user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.user.id),
      ]);
      let company = null as null | { name: string; code: string };
      if (profile?.company_id) {
        const { data: c } = await supabase
          .from("companies")
          .select("name, code")
          .eq("id", profile.company_id)
          .maybeSingle();
        company = c ?? null;
      }
      return {
        email: user.user.email ?? "",
        userId: user.user.id,
        profile,
        roles: roles?.map((r) => r.role) ?? [],
        company,
      };
    },
  });

  useEffect(() => {
    if (!profileQ.data?.profile) return;
    setFullName(profileQ.data.profile.full_name ?? "");
    setWeight(profileQ.data.profile.weight_kg?.toString() ?? "");
    setIban(profileQ.data.profile.iban ?? "");
    setAvatar(profileQ.data.profile.avatar_url ?? null);
  }, [profileQ.data]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Arrivederci!");
    await router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  async function onPickAvatar(file: File) {
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Immagine troppo grande (max 3MB)");
      return;
    }
    const dataUrl = await compressImage(file, 256);
    setAvatar(dataUrl);
    toast.message("Foto pronta — premi Salva per confermare");
  }

  const ibanCheck = validateIban(iban);
  const ibanDirty = iban.trim().length > 0;

  async function saveProfile() {
    if (!profileQ.data?.userId) return;
    if (ibanDirty && !ibanCheck.ok) {
      toast.error(`IBAN: ${ibanCheck.reason}`);
      return;
    }
    const ibanClean = ibanCheck.ok ? ibanCheck.iban : null;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName || null,
          weight_kg: weight ? Number(weight) : null,
          iban: ibanClean,
          avatar_url: avatar,
        })
        .eq("id", profileQ.data.userId);
      if (error) throw error;
      toast.success("Profilo aggiornato");
      queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (e: any) {
      toast.error(e.message ?? "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }


  async function changePassword() {
    if (pwd.length < 8) {
      toast.error("Minimo 8 caratteri");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) toast.error(error.message);
    else {
      toast.success("Password aggiornata");
      setPwd("");
    }
  }

  const isManager = profileQ.data?.roles.includes("company_manager");
  const isAdmin = profileQ.data?.roles.includes("admin");

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-md px-5 py-6">
        <CiclaLogo size="md" />

        {/* Identità + foto */}
        <Card className="mt-6 p-5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="relative grid size-20 place-items-center overflow-hidden rounded-full bg-cicla/10 text-cicla ring-2 ring-cicla/20"
              aria-label="Cambia foto profilo"
            >
              {avatar ? (
                <img src={avatar} alt="" className="size-full object-cover" />
              ) : (
                <UserIcon size={32} />
              )}
              <span className="absolute bottom-0 right-0 grid size-7 place-items-center rounded-full bg-cicla text-cicla-foreground shadow">
                <Camera size={14} />
              </span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickAvatar(f);
                e.target.value = "";
              }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-lg font-semibold">
                {fullName || "—"}
              </div>
              <div className="truncate text-sm text-muted-foreground">
                {profileQ.data?.email}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {profileQ.data?.roles.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-secondary-foreground"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Modifica profilo */}
        <Card className="mt-4 p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <UserIcon size={14} /> Dati personali
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <Label htmlFor="full_name">Nome e cognome</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Mario Rossi"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="weight">Peso (kg) — per il calcolo calorie</Label>
              <Input
                id="weight"
                type="number"
                inputMode="decimal"
                min={30}
                max={200}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="70"
                className="mt-1"
              />
            </div>
          </div>
        </Card>

        {/* IBAN prelievo */}
        <Card className="mt-4 p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Landmark size={14} /> IBAN per prelievo premi
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Verrà usato per accreditare i premi in denaro convertiti dai tuoi punti.
          </p>
          <Input
            value={iban}
            onChange={(e) => setIban(formatIban(e.target.value))}
            onBlur={() => ibanCheck.ok && setIban(ibanCheck.formatted)}
            placeholder="IT60 X054 2811 1010 0000 0123 456"
            maxLength={42}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={ibanDirty && !ibanCheck.ok}
            aria-describedby="iban-help"
            className={`mt-3 font-mono uppercase ${
              ibanDirty && !ibanCheck.ok ? "border-destructive focus-visible:ring-destructive" : ""
            }`}
          />
          <p
            id="iban-help"
            className={`mt-2 text-[11px] ${
              ibanDirty
                ? ibanCheck.ok
                  ? "text-cicla"
                  : "text-destructive"
                : "text-muted-foreground"
            }`}
          >
            {!ibanDirty
              ? "Lascia vuoto se non hai un IBAN. Sono supportati IBAN italiani ed europei."
              : ibanCheck.ok
                ? `✓ IBAN ${ibanCheck.country} valido`
                : `⚠ ${ibanCheck.reason}`}
          </p>

        </Card>

        <Button
          onClick={saveProfile}
          disabled={saving}
          className="mt-4 w-full"
        >
          <Save size={16} className="mr-2" />
          {saving ? "Salvataggio…" : "Salva modifiche"}
        </Button>

        {/* Sicurezza */}
        <Card className="mt-6 p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <KeyRound size={14} /> Sicurezza
          </div>
          <div className="mt-3 space-y-2">
            <Label htmlFor="pwd">Nuova password</Label>
            <Input
              id="pwd"
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Min 8 caratteri"
            />
            <Button
              variant="outline"
              onClick={changePassword}
              disabled={!pwd}
              className="w-full"
            >
              Aggiorna password
            </Button>
          </div>
        </Card>

        {/* Azienda */}
        {profileQ.data?.company && (
          <Card className="mt-4 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Building2 size={14} /> Azienda di appartenenza
            </div>
            <div className="mt-1 font-display text-lg font-semibold">
              {profileQ.data.company.name}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Codice: <span className="font-mono">{profileQ.data.company.code}</span>
            </div>
          </Card>
        )}

        {/* Aree riservate */}
        {(isManager || isAdmin) && (
          <Card className="mt-4 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Shield size={14} /> Aree riservate
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {isManager && (
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => navigate({ to: "/azienda" as never })}
                >
                  <Building2 size={16} className="mr-2" /> Dashboard azienda
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => navigate({ to: "/admin" as never })}
                >
                  <Shield size={16} className="mr-2" /> Pannello admin
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Shortcut */}
        <Card className="mt-4 p-3">
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/app/premi"
              preload="intent"
              className="flex items-center gap-2 rounded-xl bg-cicla/10 px-3 py-2 text-xs font-semibold text-cicla"
            >
              <Gift size={16} /> Premi
            </Link>
            <Link
              to="/app/notifiche"
              preload="intent"
              className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-xs font-semibold"
            >
              <Bell size={16} /> Notifiche
            </Link>
            <Link
              to="/app/privacy"
              preload="intent"
              className="col-span-2 flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-xs font-semibold"
            >
              <ShieldCheck size={16} /> Privacy & dati
            </Link>

          </div>
        </Card>

        <Button onClick={signOut} variant="outline" className="mt-6 w-full">
          <LogOut size={16} className="mr-2" /> Esci
        </Button>

        <div className="mt-6 flex flex-wrap justify-center gap-2 text-[10px] text-muted-foreground">
          <Link to="/legal/privacy">Privacy</Link>·
          <Link to="/legal/terms">Termini</Link>·
          <Link to="/legal/cookie">Cookie</Link>·
          <Link to="/legal/permessi">Permessi</Link>
        </div>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Cicla Qui
        </p>
      </div>
    </div>
  );
}

async function compressImage(file: File, maxSize: number): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(file);
  });
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);
  return canvas.toDataURL("image/jpeg", 0.82);
}
