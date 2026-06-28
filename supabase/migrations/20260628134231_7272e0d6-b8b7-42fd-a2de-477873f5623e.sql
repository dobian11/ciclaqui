
-- Aggiorna streak in base alla data di un viaggio (assume mode bike/foot conta, car no)
CREATE OR REPLACE FUNCTION public.bump_streak(_user_id uuid, _mode text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  today date := (now() at time zone 'utc')::date;
BEGIN
  IF _mode = 'car' THEN
    RETURN;
  END IF;

  SELECT * INTO s FROM public.streaks WHERE user_id = _user_id;
  IF NOT FOUND THEN
    INSERT INTO public.streaks(user_id, current_days, best_days, last_active_date, multiplier)
    VALUES (_user_id, 1, 1, today, 1.0);
    RETURN;
  END IF;

  IF s.last_active_date = today THEN
    RETURN; -- già contato oggi
  ELSIF s.last_active_date = today - INTERVAL '1 day' THEN
    UPDATE public.streaks
       SET current_days = s.current_days + 1,
           best_days = GREATEST(s.best_days, s.current_days + 1),
           last_active_date = today,
           multiplier = CASE
             WHEN s.current_days + 1 >= 30 THEN 1.5
             WHEN s.current_days + 1 >= 14 THEN 1.25
             WHEN s.current_days + 1 >= 7  THEN 1.10
             ELSE 1.0
           END,
           updated_at = now()
     WHERE user_id = _user_id;
  ELSE
    UPDATE public.streaks
       SET current_days = 1,
           last_active_date = today,
           multiplier = 1.0,
           updated_at = now()
     WHERE user_id = _user_id;
  END IF;
END;
$$;

-- Applica un viaggio alle sfide attive: incrementa progress e completa se goal raggiunto
CREATE OR REPLACE FUNCTION public.apply_trip_to_challenges(
  _user_id uuid, _mode text, _distance_km numeric, _company_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ch record;
  uc record;
  inc numeric;
BEGIN
  FOR ch IN
    SELECT * FROM public.challenges
     WHERE is_active = true
       AND now() BETWEEN starts_at AND ends_at
       AND (company_id IS NULL OR company_id = _company_id)
  LOOP
    -- determina incremento in base al tipo
    inc := 0;
    IF ch.type = 'km_bike' AND _mode = 'bike' THEN
      inc := _distance_km;
    ELSIF ch.type = 'km_foot' AND _mode = 'foot' THEN
      inc := _distance_km;
    ELSIF ch.type = 'km_total' AND _mode IN ('bike','foot') THEN
      inc := _distance_km;
    ELSIF ch.type = 'trips' THEN
      inc := 1;
    ELSIF ch.type = 'days_active' AND _mode IN ('bike','foot') THEN
      -- conteggio giorno unico: gestiamo tramite riga user_challenge separata
      inc := 0;
    END IF;

    IF inc <= 0 AND ch.type <> 'days_active' THEN
      CONTINUE;
    END IF;

    SELECT * INTO uc FROM public.user_challenges
      WHERE user_id = _user_id AND challenge_id = ch.id;

    IF NOT FOUND THEN
      INSERT INTO public.user_challenges(user_id, challenge_id, progress)
      VALUES (_user_id, ch.id, inc)
      RETURNING * INTO uc;
    ELSE
      UPDATE public.user_challenges
         SET progress = LEAST(ch.goal, uc.progress + inc),
             updated_at = now()
       WHERE id = uc.id
       RETURNING * INTO uc;
    END IF;

    -- complete + reward
    IF uc.completed_at IS NULL AND uc.progress >= ch.goal THEN
      UPDATE public.user_challenges
         SET completed_at = now()
       WHERE id = uc.id;

      IF ch.reward_points > 0 THEN
        INSERT INTO public.point_transactions(user_id, delta_points, delta_eur, reason)
        VALUES (_user_id, ch.reward_points, 0, 'challenge:' || ch.id);

        UPDATE public.wallets
           SET points_balance = points_balance + ch.reward_points,
               lifetime_points = lifetime_points + ch.reward_points
         WHERE user_id = _user_id;
      END IF;

      -- badge automatico
      INSERT INTO public.badges(user_id, code, title, description, icon)
      VALUES (_user_id, 'challenge_' || ch.id, ch.title, ch.description, ch.icon)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- Classifica utenti dello stesso ente (top 50 per lifetime_points)
CREATE OR REPLACE FUNCTION public.company_leaderboard(_company_id uuid)
RETURNS TABLE(user_id uuid, full_name text, lifetime_points int, lifetime_km numeric, current_streak int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name,
         COALESCE(w.lifetime_points, 0)::int,
         COALESCE(w.lifetime_km, 0),
         COALESCE(s.current_days, 0)::int
    FROM public.profiles p
    LEFT JOIN public.wallets w ON w.user_id = p.id
    LEFT JOIN public.streaks s ON s.user_id = p.id
   WHERE p.company_id = _company_id
   ORDER BY COALESCE(w.lifetime_points, 0) DESC
   LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.bump_streak(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_trip_to_challenges(uuid, text, numeric, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.company_leaderboard(uuid) TO authenticated, service_role;

-- Seed sfide globali (idempotente via codice nel titolo)
INSERT INTO public.challenges(company_id, title, description, type, period, goal, reward_points, icon, starts_at, ends_at, is_active)
SELECT NULL, '50 km in bici questa settimana', 'Pedala 50 km nei prossimi 7 giorni',
       'km_bike'::challenge_type, 'weekly'::challenge_period, 50, 200, '🚴',
       date_trunc('week', now()), date_trunc('week', now()) + INTERVAL '7 days', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.challenges WHERE title = '50 km in bici questa settimana' AND company_id IS NULL
);

INSERT INTO public.challenges(company_id, title, description, type, period, goal, reward_points, icon, starts_at, ends_at, is_active)
SELECT NULL, '200 km in bici questo mese', 'Raggiungi 200 km a pedali nel mese',
       'km_bike'::challenge_type, 'monthly'::challenge_period, 200, 800, '🏆',
       date_trunc('month', now()), date_trunc('month', now()) + INTERVAL '1 month', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.challenges WHERE title = '200 km in bici questo mese' AND company_id IS NULL
);

INSERT INTO public.challenges(company_id, title, description, type, period, goal, reward_points, icon, starts_at, ends_at, is_active)
SELECT NULL, '20 km a piedi questa settimana', 'Cammina 20 km nei prossimi 7 giorni',
       'km_foot'::challenge_type, 'weekly'::challenge_period, 20, 150, '🚶',
       date_trunc('week', now()), date_trunc('week', now()) + INTERVAL '7 days', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.challenges WHERE title = '20 km a piedi questa settimana' AND company_id IS NULL
);
