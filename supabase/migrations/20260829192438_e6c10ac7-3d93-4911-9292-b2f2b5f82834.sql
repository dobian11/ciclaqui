REVOKE SELECT ON public.challenge_prizes FROM authenticated;
GRANT SELECT (id, challenge_id, rank_position, points, reward_id, label, awarded_user_id, awarded_at, created_at, updated_at) ON public.challenge_prizes TO authenticated;
GRANT ALL ON public.challenge_prizes TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_prize_code(_prize_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cp.awarded_code
  FROM public.challenge_prizes cp
  WHERE cp.id = _prize_id
    AND (cp.awarded_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
$$;

REVOKE ALL ON FUNCTION public.get_my_prize_code(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_prize_code(uuid) TO authenticated, service_role;