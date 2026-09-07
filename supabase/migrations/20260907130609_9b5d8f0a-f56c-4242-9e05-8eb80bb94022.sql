CREATE OR REPLACE FUNCTION public.admin_decide_company(
  _company_id uuid,
  _decision text,
  _reason text DEFAULT NULL,
  _actor_id uuid DEFAULT NULL
)
RETURNS TABLE (
  company_id uuid,
  company_status public.company_status,
  decided_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  _now timestamptz := now();
  _status public.company_status;
BEGIN
  IF _actor_id IS NULL OR NOT public.has_role(_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Accesso riservato agli amministratori';
  END IF;

  IF _decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decisione non valida';
  END IF;

  IF _decision = 'rejected' AND nullif(btrim(coalesce(_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Il motivo del rifiuto è obbligatorio';
  END IF;

  UPDATE public.companies AS c
  SET status = _decision::public.company_status,
      rejection_reason = CASE WHEN _decision = 'rejected' THEN btrim(_reason) ELSE NULL END,
      approved_at = CASE WHEN _decision = 'approved' THEN _now ELSE NULL END,
      approved_by = CASE WHEN _decision = 'approved' THEN _actor_id ELSE NULL END
  WHERE c.id = _company_id
  RETURNING c.status INTO _status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ente non trovato';
  END IF;

  UPDATE public.company_reviews AS cr
  SET status = _decision,
      reason = CASE WHEN _decision = 'rejected' THEN btrim(_reason) ELSE NULL END,
      reviewed_by = _actor_id,
      reviewed_at = _now
  WHERE cr.id = (
    SELECT pending_review.id
    FROM public.company_reviews AS pending_review
    WHERE pending_review.company_id = _company_id
      AND pending_review.status = 'pending'
    ORDER BY pending_review.submitted_at DESC
    LIMIT 1
  );

  RETURN QUERY SELECT _company_id, _status, _now;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_decide_company(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_decide_company(uuid, text, text, uuid) TO service_role;