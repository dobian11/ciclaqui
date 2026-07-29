CREATE TABLE public.company_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  review_id uuid,
  template_name text NOT NULL DEFAULT 'company-decision',
  decision text,
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  idempotency_key text,
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.company_email_log TO authenticated;
GRANT ALL ON public.company_email_log TO service_role;

ALTER TABLE public.company_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all decision email logs"
ON public.company_email_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Company members read own decision email logs"
ON public.company_email_log FOR SELECT TO authenticated
USING (
  public.owns_company(company_id)
  OR company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
);

CREATE POLICY "Admins insert decision email logs"
ON public.company_email_log FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update decision email logs"
ON public.company_email_log FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_company_email_log_company ON public.company_email_log(company_id, created_at DESC);

CREATE TRIGGER update_company_email_log_updated_at
BEFORE UPDATE ON public.company_email_log
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();