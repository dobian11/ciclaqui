/**
 * Notifica il dipendente quando il saldo punti raggiunge la soglia di un premio
 * del catalogo del suo ente. Ogni premio viene notificato una sola volta
 * (deduplica sulle notifiche già inviate di tipo "reward_threshold").
 * Server-only, non lancia mai eccezioni.
 */
export async function notifyRewardThresholds(userId: string): Promise<number> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };

    const [{ data: wallet }, { data: profile }] = await Promise.all([
      db.from("wallets").select("points_balance").eq("user_id", userId).maybeSingle(),
      db.from("profiles").select("company_id").eq("id", userId).maybeSingle(),
    ]);
    const balance = Number(wallet?.points_balance ?? 0);
    const companyId = profile?.company_id ?? null;
    if (!balance || !companyId) return 0;

    const { data: rewards } = await db
      .from("rewards_catalog")
      .select("id, title, points_cost, stock")
      .eq("active", true)
      .eq("scope", "company")
      .eq("company_id", companyId)
      .lte("points_cost", balance)
      .order("points_cost", { ascending: false });

    const candidates = (rewards ?? []).filter(
      (r: { stock: number | null }) => r.stock === null || Number(r.stock) > 0,
    );
    if (!candidates.length) return 0;

    // Premi già riscattati → nessuna notifica di soglia.
    const { data: redeemed } = await db
      .from("reward_redemptions")
      .select("reward_id, status")
      .eq("user_id", userId);
    const redeemedIds = new Set(
      (redeemed ?? [])
        .filter((r: { status: string }) => r.status !== "cancelled")
        .map((r: { reward_id: string }) => r.reward_id),
    );

    // Premi già segnalati in passato.
    const { data: sent } = await db
      .from("user_notifications")
      .select("payload")
      .eq("user_id", userId)
      .eq("type", "reward_threshold")
      .limit(200);
    const notified = new Set(
      (sent ?? [])
        .map((n: { payload: Record<string, unknown> | null }) => n.payload?.["reward_id"])
        .filter(Boolean) as string[],
    );

    const toNotify = candidates.filter(
      (r: { id: string }) => !redeemedIds.has(r.id) && !notified.has(r.id),
    );
    if (!toNotify.length) return 0;

    const { notifyUsers } = await import("@/lib/notify.server");
    for (const r of toNotify) {
      await notifyUsers({
        userIds: [userId],
        topic: "rewards",
        type: "reward_threshold",
        title: "Hai raggiunto la soglia di un premio",
        body: `Con ${balance} punti puoi riscattare "${r.title}" (${r.points_cost} punti).`,
        url: "/app/punti?tab=rewards",
        companyId,
        ctaLabel: "Riscatta ora",
        details: [
          { label: "Premio", value: r.title },
          { label: "Punti richiesti", value: String(r.points_cost) },
          { label: "Il tuo saldo", value: String(balance) },
        ],
        payload: { reward_id: r.id, ref: `threshold:${r.id}` },
      });
    }
    return toNotify.length;
  } catch (e) {
    console.error("[notifyRewardThresholds]", e);
    return 0;
  }
}
