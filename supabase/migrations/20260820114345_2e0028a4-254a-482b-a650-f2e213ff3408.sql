CREATE TABLE public.challenge_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  rank_position smallint NOT NULL CHECK (rank_position BETWEEN 1 AND 3),
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  reward_id uuid REFERENCES public.rewards_catalog(id) ON DELETE SET NULL,
  label text,
  awarded_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  awarded_at timestamptz,
  awarded_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, rank_position)
);

GRANT SELECT ON public.challenge_prizes TO authenticated;
GRANT ALL ON public.challenge_prizes TO service_role;

ALTER TABLE public.challenge_prizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read challenge prizes"
ON public.challenge_prizes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.challenges c
    LEFT JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = challenge_prizes.challenge_id
      AND (c.company_id IS NULL OR c.company_id = p.company_id OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "admins manage challenge prizes"
ON public.challenge_prizes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_challenge_prizes_updated
BEFORE UPDATE ON public.challenge_prizes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.award_challenge_podium(_challenge_id uuid)
RETURNS TABLE(out_position smallint, out_user_id uuid, out_points integer, out_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ch public.challenges%ROWTYPE;
  _prize public.challenge_prizes%ROWTYPE;
  _winner uuid;
  _code text;
  _reward public.rewards_catalog%ROWTYPE;
BEGIN
  SELECT * INTO _ch FROM public.challenges WHERE id = _challenge_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sfida non trovata'; END IF;

  FOR _prize IN
    SELECT * FROM public.challenge_prizes
     WHERE challenge_id = _challenge_id AND awarded_at IS NULL
     ORDER BY rank_position
  LOOP
    SELECT uc.user_id INTO _winner
      FROM public.user_challenges uc
     WHERE uc.challenge_id = _challenge_id
       AND uc.progress > 0
       AND NOT EXISTS (
         SELECT 1 FROM public.challenge_prizes cp
          WHERE cp.challenge_id = _challenge_id AND cp.awarded_user_id = uc.user_id
       )
     ORDER BY uc.progress DESC, uc.updated_at ASC
     LIMIT 1;

    IF _winner IS NULL THEN
      CONTINUE;
    END IF;

    _code := NULL;

    IF _prize.points > 0 THEN
      INSERT INTO public.point_transactions(user_id, delta_points, delta_eur, reason)
      VALUES (_winner, _prize.points, 0, 'podium:' || _challenge_id || ':' || _prize.rank_position);

      UPDATE public.wallets w
         SET points_balance = w.points_balance + _prize.points,
             lifetime_points = w.lifetime_points + _prize.points
       WHERE w.user_id = _winner;
    END IF;

    IF _prize.reward_id IS NOT NULL THEN
      SELECT * INTO _reward FROM public.rewards_catalog WHERE id = _prize.reward_id FOR UPDATE;
      IF FOUND THEN
        _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
        INSERT INTO public.reward_redemptions(user_id, reward_id, code, points_spent, status)
        VALUES (_winner, _reward.id, _code, 0, 'active');
        IF _reward.stock IS NOT NULL AND _reward.stock > 0 THEN
          UPDATE public.rewards_catalog SET stock = stock - 1 WHERE id = _reward.id;
        END IF;
      END IF;
    END IF;

    INSERT INTO public.badges(user_id, code, title, description, icon, company_id)
    VALUES (
      _winner,
      'podium_' || _challenge_id || '_' || _prize.rank_position,
      COALESCE(_ch.trophy_label, _ch.title) || ' - ' || _prize.rank_position || ' posto',
      COALESCE(_prize.label, 'Premio podio'),
      CASE _prize.rank_position WHEN 1 THEN '🥇' WHEN 2 THEN '🥈' ELSE '🥉' END,
      _ch.company_id
    ) ON CONFLICT DO NOTHING;

    INSERT INTO public.user_notifications(user_id, type, title, body, company_id, payload)
    VALUES (
      _winner, 'challenge_podium',
      _prize.rank_position || ' posto: ' || _ch.title,
      COALESCE(_prize.label, 'Hai vinto un premio!') ||
        CASE WHEN _prize.points > 0 THEN ' (+' || _prize.points || ' punti)' ELSE '' END,
      _ch.company_id,
      jsonb_build_object('challenge_id', _challenge_id, 'position', _prize.rank_position, 'code', _code)
    );

    UPDATE public.challenge_prizes
       SET awarded_user_id = _winner, awarded_at = now(), awarded_code = _code
     WHERE id = _prize.id;

    out_position := _prize.rank_position;
    out_user_id := _winner;
    out_points := _prize.points;
    out_code := _code;
    RETURN NEXT;
  END LOOP;
END;
$$;