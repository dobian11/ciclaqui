CREATE TABLE public.company_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid,
  actor_name text,
  actor_role text,
  document_name text,
  document_path text,
  review_id uuid,
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_company_audit_log_company ON public.company_audit_log (company_id, created_at DESC);
CREATE INDEX idx_company_audit_log_action ON public.company_audit_log (action, created_at DESC);

GRANT SELECT ON public.company_audit_log TO authenticated;
GRANT ALL ON public.company_audit_log TO service_role;

ALTER TABLE public.company_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all audit entries"
  ON public.company_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Company owners can read their audit entries"
  ON public.company_audit_log FOR SELECT TO authenticated
  USING (public.owns_company(company_id));