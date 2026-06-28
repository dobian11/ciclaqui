
CREATE TABLE public.telemetry_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  duration_ms INTEGER,
  error_message TEXT,
  meta JSONB,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX telemetry_events_user_idx ON public.telemetry_events(user_id, created_at DESC);
CREATE INDEX telemetry_events_source_idx ON public.telemetry_events(source, status, created_at DESC);

GRANT SELECT, INSERT ON public.telemetry_events TO authenticated;
GRANT ALL ON public.telemetry_events TO service_role;

ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own telemetry"
  ON public.telemetry_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users read own telemetry"
  ON public.telemetry_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins read all telemetry"
  ON public.telemetry_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
