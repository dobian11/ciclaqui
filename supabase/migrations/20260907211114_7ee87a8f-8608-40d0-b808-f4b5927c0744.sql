CREATE TABLE IF NOT EXISTS public.cron_tokens (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.cron_tokens TO service_role;

ALTER TABLE public.cron_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role manages cron tokens" ON public.cron_tokens;
CREATE POLICY "service role manages cron tokens"
  ON public.cron_tokens FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_cron_tokens_updated_at ON public.cron_tokens;
CREATE TRIGGER update_cron_tokens_updated_at
  BEFORE UPDATE ON public.cron_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();