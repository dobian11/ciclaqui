DROP POLICY IF EXISTS "members read challenge prizes" ON public.challenge_prizes;

CREATE POLICY "members read challenge prizes"
ON public.challenge_prizes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM challenges c
    LEFT JOIN profiles p ON p.id = auth.uid()
    WHERE c.id = challenge_prizes.challenge_id
      AND (c.company_id IS NULL OR c.company_id = p.company_id OR public.has_role(auth.uid(), 'admin'))
  )
  AND (
    awarded_user_id IS NULL
    OR awarded_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM challenges c2
      WHERE c2.id = challenge_prizes.challenge_id
        AND c2.company_id IS NOT NULL
        AND public.owns_company(c2.company_id)
    )
  )
);

REVOKE SELECT (awarded_code) ON public.challenge_prizes FROM authenticated, anon;