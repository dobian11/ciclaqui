CREATE TABLE public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text,
  percent_off integer NOT NULL DEFAULT 100 CHECK (percent_off BETWEEN 1 AND 100),
  plan subscription_plan,
  max_redemptions integer,
  redeemed_count integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_codes TO authenticated;
GRANT ALL ON public.discount_codes TO service_role;

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage discount codes"
ON public.discount_codes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_discount_codes_updated_at
BEFORE UPDATE ON public.discount_codes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.company_subscriptions
  ADD COLUMN IF NOT EXISTS discount_code text,
  ADD COLUMN IF NOT EXISTS monthly_price_eur numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seats integer NOT NULL DEFAULT 10;

CREATE UNIQUE INDEX IF NOT EXISTS company_subscriptions_company_id_key
  ON public.company_subscriptions(company_id);

-- Il numero di account collegati a un ente non può superare i posti del piano
CREATE OR REPLACE FUNCTION public.enforce_company_seat_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cap integer;
  _used integer;
BEGIN
  IF NEW.company_id IS NULL OR NEW.company_id IS NOT DISTINCT FROM OLD.company_id THEN
    RETURN NEW;
  END IF;

  SELECT employee_cap INTO _cap FROM public.companies WHERE id = NEW.company_id;
  IF _cap IS NULL OR _cap <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO _used FROM public.profiles WHERE company_id = NEW.company_id AND id <> NEW.id;
  IF _used >= _cap THEN
    RAISE EXCEPTION 'Posti esauriti per questo ente: il piano include % account', _cap;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_company_seat_cap ON public.profiles;
CREATE TRIGGER trg_enforce_company_seat_cap
BEFORE INSERT OR UPDATE OF company_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_company_seat_cap();