import { useEffect, useState } from "react";
import { Gift, Tag, Heart, Banknote, Building2, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { redeemReward } from "@/lib/rewards.functions";
import { toast } from "sonner";
import { rewardCategoryMeta } from "@/lib/reward-categories";

type Reward = {
  id: string;
  title: string;
  description: string | null;
  partner: string | null;
  category: string;
  points_cost: number;
  cash_value_eur: number | null;
  image_url: string | null;
  region: string | null;
  scope: string;
  company_id: string | null;
  stock: number | null;
};


type Redemption = {
  id: string;
  code: string;
  points_spent: number;
  status: string;
  redeemed_at: string;
  used_at: string | null;
  expires_at: string | null;
  cancel_reason: string | null;
  rewards_catalog: { title: string; category: string; cash_value_eur: number | null; partner: string | null } | null;
};

/** Stato del riscatto dal punto di vista del dipendente. */
function redemptionStatus(r: Redemption): { label: string; tone: "ok" | "wait" | "bad" } {
  if (r.status === "cancelled") return { label: "Annullato", tone: "bad" };
  if (r.status === "confirmed" || r.status === "used") return { label: "Confermato", tone: "ok" };
  const isCash = r.rewards_catalog?.category === "cash" && Number(r.rewards_catalog?.cash_value_eur ?? 0) > 0;
  // voucher sbloccato subito; premio in denaro = richiesta inviata all'ente
  return isCash ? { label: "Inviato all'ente", tone: "wait" } : { label: "Sbloccato", tone: "ok" };
}

export function RewardsCatalog() {
  const [tab, setTab] = useState<"national" | "local" | "cash" | "donation" | "company" | "mine">("company");
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [mine, setMine] = useState<Redemption[]>([]);
  const [redeemedIds, setRedeemedIds] = useState<string[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: w } = await supabase.from("wallets").select("points_balance").eq("user_id", user.id).maybeSingle();
        setBalance(w?.points_balance ?? 0);
        // Premi già riscattati: uno stesso premio non può essere riscattato due volte.
        const { data: red } = await supabase
          .from("reward_redemptions")
          .select("reward_id, status")
          .eq("user_id", user.id);
        setRedeemedIds(
          (red ?? [])
            .filter((r: { status: string }) => r.status !== "cancelled")
            .map((r: { reward_id: string }) => r.reward_id),
        );
      } else {
        setBalance(0);
        setRedeemedIds([]);
      }

      if (tab === "mine") {
        if (!user) {
          setMine([]);
          setLoading(false);
          return;
        }
        const { data } = await supabase
          .from("reward_redemptions")
          .select("id, code, points_spent, status, redeemed_at, used_at, expires_at, cancel_reason, rewards_catalog(title, category, cash_value_eur, partner)")
          .eq("user_id", user.id)
          .order("redeemed_at", { ascending: false });
        setMine((data ?? []) as unknown as Redemption[]);
        setLoading(false);
        return;
      }
      if (tab === "company") {
        let companyId: string | null = null;
        if (user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("company_id")
            .eq("id", user.id)
            .maybeSingle();
          companyId = prof?.company_id ?? null;
        }
        if (!companyId) {
          setRewards([]);
          setLoading(false);
          return;
        }
        const { data } = await supabase
          .from("rewards_catalog")
          .select("*")
          .eq("active", true)
          .eq("scope", "company")
          .eq("company_id", companyId)
          .order("points_cost");
        setRewards((data ?? []) as Reward[]);
        setLoading(false);
        return;
      }
      const cat = tab === "cash" ? "cash" : tab === "donation" ? "donation" : "voucher";
      const scope = tab === "local" ? "local" : "national";
      const { data } = await supabase.from("rewards_catalog").select("*").eq("active", true).eq("category", cat).eq("scope", scope).order("points_cost");
      setRewards((data ?? []) as Reward[]);
      setLoading(false);
    })();
  }, [tab, reloadKey]);

  async function redeem(r: Reward) {
    if (balance < r.points_cost) return toast.error("Punti insufficienti");
    if (redeemedIds.includes(r.id)) return toast.error("Hai già riscattato questo premio");
    if (r.stock !== null && r.stock <= 0) return toast.error("Premio esaurito");
    try {
      const data = await redeemReward({ data: { rewardId: r.id } });
      setBalance(balance - r.points_cost);
      setRedeemedIds((prev) => [...prev, r.id]);
      toast.success(
        data.cash
          ? `Richiesta inviata! Il tuo ente pagherà l'importo sul tuo IBAN. Rif. ${data.code}`
          : `Riscattato! Codice: ${data.code}`,
      );
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossibile riscattare il premio");
    }
  }


  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto text-[11px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Tab active={tab === "company"} onClick={() => setTab("company")} icon={Building2}>Il mio ente</Tab>
        <Tab active={tab === "national"} onClick={() => setTab("national")} icon={Tag}>Nazionali</Tab>
        <Tab active={tab === "local"} onClick={() => setTab("local")} icon={Gift}>Locali</Tab>
        <Tab active={tab === "cash"} onClick={() => setTab("cash")} icon={Banknote}>Cash</Tab>
        <Tab active={tab === "donation"} onClick={() => setTab("donation")} icon={Heart}>Donazioni</Tab>
        <Tab active={tab === "mine"} onClick={() => setTab("mine")} icon={Ticket}>I miei</Tab>
      </div>

      {loading && <p className="text-xs text-muted-foreground">Caricamento…</p>}

      {!loading && tab === "mine" && (
        mine.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Non hai ancora premi riscattati o vinti sul podio.
          </div>
        ) : (
          mine.map((m) => {
            const st = redemptionStatus(m);
            const cash = m.rewards_catalog?.category === "cash" && Number(m.rewards_catalog?.cash_value_eur ?? 0) > 0;
            return (
            <div key={m.id} className="rounded-2xl border border-border bg-card/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-sm font-bold">{m.rewards_catalog?.title ?? "Premio"}</h3>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {rewardCategoryMeta(m.rewards_catalog?.category ?? "voucher").emoji}{" "}
                      {rewardCategoryMeta(m.rewards_catalog?.category ?? "voucher").label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {m.points_spent === 0 ? "Vinto sul podio" : `${m.points_spent} punti`}
                    </span>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    st.tone === "ok"
                      ? "bg-cicla/15 text-cicla"
                      : st.tone === "wait"
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {st.label}
                </span>
              </div>

              {m.status !== "cancelled" && (
                <div className="mt-3 rounded-xl bg-black/30 px-3 py-2 font-mono text-sm tracking-widest">{m.code}</div>
              )}

              <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                <p>Richiesto il {new Date(m.redeemed_at).toLocaleString("it-IT")}</p>
                {m.used_at && <p>Confermato il {new Date(m.used_at).toLocaleString("it-IT")}</p>}
                {m.expires_at && m.status !== "cancelled" && (
                  <p>Valido fino al {new Date(m.expires_at).toLocaleDateString("it-IT")}</p>
                )}
                {cash && (
                  <p>
                    Valore € {Number(m.rewards_catalog?.cash_value_eur).toFixed(2)} — bonifico dell'ente sull'IBAN del
                    profilo.
                  </p>
                )}
                {m.rewards_catalog?.partner && <p>Partner: {m.rewards_catalog.partner}</p>}
              </div>

              {m.status === "cancelled" && m.cancel_reason && (
                <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                  Motivo dell'annullamento: {m.cancel_reason}
                </p>
              )}
            </div>
            );
          })
        )
      )}

      {!loading && tab !== "mine" && rewards.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          {tab === "company"
            ? "Nessun premio dal tuo ente. Se il tuo ente ne ha pubblicati e non li vedi, verifica di esserti registrato con il suo codice."
            : "Nessun premio disponibile in questa categoria. Stiamo aggiungendo nuovi partner ogni settimana."}
        </div>
      )}
      {tab !== "mine" && rewards.map((r) => {
        const already = redeemedIds.includes(r.id);
        const soldOut = r.stock !== null && r.stock <= 0;
        const missing = Math.max(0, r.points_cost - balance);
        const pct = Math.min(100, Math.round((balance / Math.max(1, r.points_cost)) * 100));
        return (
        <div key={r.id} className="rounded-2xl border border-border bg-card/50 p-4">
          <div className="flex items-start gap-3">
            {r.image_url ? <img src={r.image_url} alt="" className="size-14 rounded-xl object-cover" /> : <div className="grid size-14 place-items-center rounded-xl bg-cicla/15"><Gift size={20} className="text-cicla" /></div>}
            <div className="flex-1">
              <h3 className="font-display text-sm font-bold">{r.title}</h3>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {rewardCategoryMeta(r.category).emoji} {rewardCategoryMeta(r.category).label}
                </span>
                {r.partner && <span className="text-[11px] text-muted-foreground">{r.partner}</span>}
                {r.stock !== null && (
                  <span className="text-[11px] text-muted-foreground">
                    {soldOut ? "Esaurito" : `${r.stock} disponibili`}
                  </span>
                )}
              </div>
              {r.description && <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>}
              {r.category === "cash" && r.cash_value_eur ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Valore € {Number(r.cash_value_eur).toFixed(2)} — pagato dal tuo ente sull'IBAN del profilo.
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-cicla transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="text-xs">
              <span className="font-bold text-cicla">{r.points_cost}</span> punti
              {missing > 0 && !already && (
                <span className="ml-1 text-muted-foreground">· ti mancano {missing}</span>
              )}
            </div>
            <button
              onClick={() => redeem(r)}
              disabled={balance < r.points_cost || already || soldOut}
              className="rounded-full bg-cicla px-4 py-1.5 text-xs font-bold text-cicla-foreground disabled:opacity-40"
            >
              {already ? "Già riscattato" : soldOut ? "Esaurito" : "Riscatta"}
            </button>
          </div>
        </div>
        );
      })}

    </div>
  );
}

function Tab({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ComponentType<{size?:number}>; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 font-semibold transition-colors ${active ? "bg-cicla text-cicla-foreground" : "bg-card text-muted-foreground"}`}>
      <Icon size={12} /> {children}
    </button>
  );
}
