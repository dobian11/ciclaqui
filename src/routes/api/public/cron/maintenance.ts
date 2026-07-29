import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron di manutenzione periodica (chiamabile da pg_cron o da uno scheduler esterno).
 * Protetto da header `x-cron-secret` confrontato con il secret CRON_SECRET.
 *
 * Cosa fa:
 *  1. Disattiva le sfide scadute (ends_at < now).
 *  2. Rigenera automaticamente le sfide ricorrenti (weekly/monthly) per il periodo successivo.
 *  3. Azzera le streak di chi non è attivo da più di 1 giorno.
 */
export const Route = createFileRoute("/api/public/cron/maintenance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const provided = request.headers.get("x-cron-secret");
        if (!secret || !provided || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date();
        const nowIso = now.toISOString();

        // 1. Sfide scadute
        const { data: expired } = await supabaseAdmin
          .from("challenges")
          .select("*")
          .eq("is_active", true)
          .lt("ends_at", nowIso);

        let closed = 0;
        let recreated = 0;

        if (expired?.length) {
          await supabaseAdmin
            .from("challenges")
            .update({ is_active: false, updated_at: nowIso })
            .in(
              "id",
              expired.map((c) => c.id),
            );
          closed = expired.length;

          // 2. Rigenerazione ricorrenti
          const recurring = expired.filter((c) => c.period === "weekly" || c.period === "monthly");
          for (const c of recurring) {
            const starts = new Date(c.ends_at);
            const ends = new Date(starts);
            if (c.period === "weekly") ends.setDate(ends.getDate() + 7);
            else ends.setMonth(ends.getMonth() + 1);
            // salta se il periodo successivo è già passato o già esiste
            if (ends <= now) continue;
            const { data: exists } = await supabaseAdmin
              .from("challenges")
              .select("id")
              .eq("title", c.title)
              .eq("period", c.period)
              .eq("starts_at", starts.toISOString())
              .maybeSingle();
            if (exists) continue;

            await supabaseAdmin.from("challenges").insert({
              company_id: c.company_id,
              title: c.title,
              description: c.description,
              type: c.type,
              period: c.period,
              goal: c.goal,
              reward_points: c.reward_points,
              icon: c.icon,
              starts_at: starts.toISOString(),
              ends_at: ends.toISOString(),
              is_active: true,
              created_by: c.created_by,
            });
            recreated += 1;
          }
        }

        // 3. Streak interrotte
        const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
        const { data: broken } = await supabaseAdmin
          .from("streaks")
          .select("user_id")
          .lt("last_active_date", yesterday)
          .gt("current_days", 0);

        if (broken?.length) {
          await supabaseAdmin
            .from("streaks")
            .update({ current_days: 0, multiplier: 1.0, updated_at: nowIso })
            .in(
              "user_id",
              broken.map((s) => s.user_id),
            );
        }

        // 4. Cancellazioni account programmate e scadute
        const { data: deletions } = await supabaseAdmin
          .from("account_deletion_requests")
          .select("id, user_id")
          .is("cancelled_at", null)
          .lt("scheduled_for", nowIso);

        let deleted = 0;
        for (const d of deletions ?? []) {
          const { error } = await supabaseAdmin.auth.admin.deleteUser(d.user_id);
          if (!error) {
            await supabaseAdmin.from("account_deletion_requests").delete().eq("id", d.id);
            deleted += 1;
          }
        }

        return Response.json({
          ok: true,
          accounts_deleted: deleted,
          challenges_closed: closed,
          challenges_recreated: recreated,
          streaks_reset: broken?.length ?? 0,
          at: nowIso,
        });
      },
    },
  },
});
