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
};

type Redemption = {
  id: string;
  code: string;
  points_spent: number;
  status: string;
  redeemed_at: string;
  rewards_catalog: { title: string; category: string } | null;
};

export function RewardsCatalog() {
  const [tab, setTab] = useState<"national" | "local" | "cash" | "donation" | "company" | "mine">("company");
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [mine, setMine] = useState<Redemption[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: w } = await supabase.from("wallets").select("points_balance").eq("user_id", user.id).maybeSingle();
        setBalance(w?.points_balance ?? 0);
      } else {
        setBalance(0);
      }
      if (tab === "mine") {
        if (!user) {
          setMine([]);
          setLoading(false);
          return;
        }
        const { data } = await supabase
          .from("reward_redemptions")
          .select("id, code, points_spent, status, redeemed_at, rewards_catalog(title, category)")
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
  }, [tab]);

  async function redeem(r: Reward) {
    if (balance < r.points_cost) return toast.error("Punti insufficienti");
    try {
      const data = await redeemReward({ data: { rewardId: r.id } });
      setBalance(balance - r.points_cost);
      toast.success(`Riscattato! Codice: ${data.code}`);
    } catch {
      toast.error("Impossibile riscattare il premio");
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
      </div>

      {loading && <p className="text-xs text-muted-foreground">Caricamento…</p>}
      {!loading && rewards.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          {tab === "company"
            ? "Nessun premio dal tuo ente. Se il tuo ente ne ha pubblicati e non li vedi, verifica di esserti registrato con il suo codice."
            : "Nessun premio disponibile in questa categoria. Stiamo aggiungendo nuovi partner ogni settimana."}
        </div>
      )}
      {rewards.map((r) => (
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
              </div>
              {r.description && <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs"><span className="font-bold text-cicla">{r.points_cost}</span> punti</div>
            <button onClick={() => redeem(r)} disabled={balance < r.points_cost} className="rounded-full bg-cicla px-4 py-1.5 text-xs font-bold text-cicla-foreground disabled:opacity-40">Riscatta</button>
          </div>
        </div>
      ))}
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
