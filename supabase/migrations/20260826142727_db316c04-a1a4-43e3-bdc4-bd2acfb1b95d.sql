CREATE OR REPLACE FUNCTION public.apply_trip_to_challenges(
  _user_id uuid,
  _mode text,
  _distance_km numeric,
  _company_id uuid,
  _count_trip boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ch record;
  uc record;
  inc numeric;
  t text;
BEGIN
  IF _mode = 'car' THEN
    RETURN;
  END IF;

  FOR ch IN
    SELECT * FROM public.challenges
     WHERE is_active = true
       AND now() BETWEEN starts_at AND ends_at
       AND (company_id IS NULL OR company_id = _company_id)
  LOOP
    t := ch.type::text;
    inc := 0;

    IF t = 'km_bike' AND _mode = 'bike' THEN
      inc := _distance_km;
    ELSIF t = 'km_foot' AND _mode = 'foot' THEN
      inc := _distance_km;
    ELSIF t = 'trip_count' THEN
      inc := CASE WHEN _count_trip THEN 1 ELSE 0 END;
    ELSIF t = 'co2_saved' THEN
      inc := ROUND(_distance_km * 0.192, 3);
    ELSIF t = 'streak_days' THEN
      SELECT GREATEST(0, COALESCE(s.current_days, 0) - COALESCE(u.progress, 0))
        INTO inc
        FROM public.streaks s
        LEFT JOIN public.user_challenges u
          ON u.user_id = _user_id AND u.challenge_id = ch.id
       WHERE s.user_id = _user_id;
      inc := COALESCE(inc, 0);
    END IF;

    IF inc IS NULL OR inc <= 0 THEN
      CONTINUE;
    END IF;

    SELECT * INTO uc FROM public.user_challenges
      WHERE user_id = _user_id AND challenge_id = ch.id;

    IF NOT FOUND THEN
      INSERT INTO public.user_challenges(user_id, challenge_id, progress)
      VALUES (_user_id, ch.id, LEAST(ch.goal, inc))
      RETURNING * INTO uc;
    ELSE
      UPDATE public.user_challenges
         SET progress = LEAST(ch.goal, uc.progress + inc),
             updated_at = now()
       WHERE id = uc.id
       RETURNING * INTO uc;
    END IF;

    IF uc.completed_at IS NULL AND uc.progress >= ch.goal THEN
      UPDATE public.user_challenges
         SET completed_at = now()
       WHERE id = uc.id;

      IF ch.reward_points > 0 THEN
        INSERT INTO public.point_transactions(user_id, delta_points, delta_eur, reason)
        VALUES (_user_id, ch.reward_points, 0, 'challenge:' || ch.id);

        INSERT INTO public.wallets(user_id, points_balance, lifetime_points)
        VALUES (_user_id, ch.reward_points, ch.reward_points)
        ON CONFLICT (user_id) DO UPDATE
          SET points_balance = public.wallets.points_balance + ch.reward_points,
              lifetime_points = public.wallets.lifetime_points + ch.reward_points,
              updated_at = now();
      END IF;

      INSERT INTO public.badges(user_id, code, title, description, icon, company_id)
      VALUES (_user_id, 'challenge_' || ch.id, ch.title, ch.description, COALESCE(ch.icon, '🏆'), ch.company_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$function$;