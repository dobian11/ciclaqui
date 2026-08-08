-- 1) Nessun accesso anonimo alla tabella enti (la validazione del codice passa dal server)
REVOKE SELECT ON public.companies FROM anon;

-- 2) Sostituisce la policy permissiva USING(true) con una ancorata all'utente
DROP POLICY IF EXISTS "public can read safe company columns" ON public.companies;

CREATE POLICY "members read their own company"
ON public.companies
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR id = (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
);

-- 3) Le colonne sensibili restano fuori dai grant per authenticated
REVOKE SELECT (iban, vat, contact_email, stripe_customer_id) ON public.companies FROM authenticated;