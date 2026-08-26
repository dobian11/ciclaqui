
create or replace function public.guard_companies_manager_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin: nessuna restrizione
  if public.has_role(auth.uid(), 'admin'::app_role) then
    return new;
  end if;

  -- Il titolare puo' modificare solo campi non sensibili.
  -- Ogni campo di approvazione, codice, piano o dati finanziari resta immutabile.
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

  return new;
end;
$$;

drop trigger if exists guard_companies_manager_update on public.companies;
create trigger guard_companies_manager_update
before update on public.companies
for each row execute function public.guard_companies_manager_update();
