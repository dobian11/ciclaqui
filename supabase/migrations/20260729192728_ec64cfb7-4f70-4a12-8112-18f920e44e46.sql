ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _company_code text;
  _company_id uuid;
  _signup_kind text;
BEGIN
  _signup_kind := COALESCE(NEW.raw_user_meta_data->>'signup_kind', 'user');
  _company_code := NEW.raw_user_meta_data->>'company_code';

  IF _company_code IS NOT NULL AND length(_company_code) > 0 THEN
    SELECT id INTO _company_id FROM public.companies WHERE code = upper(_company_code) LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    _company_id
  );

  IF _signup_kind = 'company_manager' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'company_manager');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  INSERT INTO public.wallets (user_id) VALUES (NEW.id);

  RETURN NEW;
END;
$function$;