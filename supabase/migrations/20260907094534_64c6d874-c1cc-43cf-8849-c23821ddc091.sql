ALTER TYPE public.subscription_plan ADD VALUE IF NOT EXISTS 'advanced';

CREATE TABLE IF NOT EXISTS public.promo_banner (
  id integer PRIMARY KEY DEFAULT 1,
  active boolean NOT NULL DEFAULT false,
  title text NOT NULL DEFAULT 'Promo lancio aziende',
  message text NOT NULL DEFAULT 'Se ti abboni entro il 15.01.27 per la tua azienda, 10% di sconto.',
  percent_off integer NOT NULL DEFAULT 10,
  ends_at timestamptz NOT NULL DEFAULT '2027-01-15T22:59:59Z',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_banner_single CHECK (id = 1),
  CONSTRAINT promo_banner_percent CHECK (percent_off >= 0 AND percent_off <= 100)
);

GRANT SELECT ON public.promo_banner TO authenticated, anon;
GRANT ALL ON public.promo_banner TO service_role;

ALTER TABLE public.promo_banner ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone read promo banner" ON public.promo_banner;
CREATE POLICY "anyone read promo banner" ON public.promo_banner
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admins update promo banner" ON public.promo_banner;
CREATE POLICY "admins update promo banner" ON public.promo_banner
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.promo_banner (id) VALUES (1) ON CONFLICT (id) DO NOTHING;