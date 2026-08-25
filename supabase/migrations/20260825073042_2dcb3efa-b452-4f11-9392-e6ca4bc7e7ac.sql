ALTER TABLE public.trip_flags ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
COMMENT ON COLUMN public.trip_flags.created_by IS 'Chi ha creato la segnalazione. NULL = pipeline anti-frode automatica (service role).';

CREATE TABLE public.trip_flags_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_flag_id uuid NOT NULL REFERENCES public.trip_flags(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('insert','update','delete')),
  actor_id uuid,
  actor_role text NOT NULL DEFAULT 'service',
  old_row jsonb,
  new_row jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_flags_audit_flag ON public.trip_flags_audit(trip_flag_id, created_at DESC);

GRANT SELECT ON public.trip_flags_audit TO authenticated;
GRANT ALL ON public.trip_flags_audit TO service_role;

ALTER TABLE public.trip_flags_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read trip flag audit"
ON public.trip_flags_audit FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "managers read company trip flag audit"
ON public.trip_flags_audit FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'company_manager')
  AND EXISTS (
    SELECT 1
    FROM public.trip_flags tf
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE tf.id = trip_flags_audit.trip_flag_id
      AND tf.company_id IS NOT NULL
      AND tf.company_id = p.company_id
  )
);

CREATE OR REPLACE FUNCTION public.audit_trip_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid;
  _role text;
BEGIN
  BEGIN
    _actor := auth.uid();
    _role := COALESCE(auth.jwt()->>'role', 'service');
  EXCEPTION WHEN OTHERS THEN
    _actor := NULL;
    _role := 'service';
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.trip_flags_audit(trip_flag_id, action, actor_id, actor_role, new_row)
    VALUES (NEW.id, 'insert', _actor, _role, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.trip_flags_audit(trip_flag_id, action, actor_id, actor_role, old_row, new_row)
    VALUES (NEW.id, 'update', _actor, _role, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO public.trip_flags_audit(trip_flag_id, action, actor_id, actor_role, old_row)
    VALUES (OLD.id, 'delete', _actor, _role, to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_trip_flags_audit ON public.trip_flags;
CREATE TRIGGER trg_trip_flags_audit
AFTER INSERT OR UPDATE OR DELETE ON public.trip_flags
FOR EACH ROW EXECUTE FUNCTION public.audit_trip_flags();