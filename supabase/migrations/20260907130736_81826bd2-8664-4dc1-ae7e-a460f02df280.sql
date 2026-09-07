CREATE OR REPLACE FUNCTION public.guard_companies_manager_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Gli amministratori autenticati e il servizio interno possono modificare
  -- i campi riservati. Il servizio interno è necessario per le decisioni
  -- validate dalla funzione admin_decide_company.
  IF public.has_role(auth.uid(), 'admin'::public.app_role)
     OR coalesce(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN new;
  END IF;

  -- Il titolare può modificare solo campi non sensibili.
  new.id := old.id;
  new.code := old.code;
  new.status := old.status;
  new.approved_at := old.approved_at;
  new.approved_by := old.approved_by;
  new.rejection_reason := old.rejection_reason;
  new.iban := old.iban;
  new.plan := old.plan;
  new.subscription_status := old.subscription_status;
  new.employee_cap := old.employee_cap;
  new.stripe_customer_id := old.stripe_customer_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.kind := old.kind;

  RETURN new;
END;
$$;