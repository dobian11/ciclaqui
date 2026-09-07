CREATE OR REPLACE FUNCTION public.prevent_profile_company_hijack()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.company_id IS NOT NULL
       AND auth.uid() IS NOT NULL
       AND NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Il collegamento a un ente può avvenire solo tramite codice ente verificato';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Il collegamento a un ente può avvenire solo tramite codice ente verificato';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_profile_company_hijack ON public.profiles;
CREATE TRIGGER trg_prevent_profile_company_hijack
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_company_hijack();

DROP POLICY IF EXISTS "users insert own profile" ON public.profiles;
CREATE POLICY "users insert own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (id = auth.uid() AND company_id IS NULL);

DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());