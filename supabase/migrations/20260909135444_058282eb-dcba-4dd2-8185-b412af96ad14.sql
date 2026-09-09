ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname text;

CREATE OR REPLACE FUNCTION public.generate_nickname(_seed text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _base text;
  _try text;
  _i int := 0;
BEGIN
  _base := lower(regexp_replace(COALESCE(split_part(_seed, ' ', 1), ''), '[^a-zA-Z0-9]', '', 'g'));
  IF _base IS NULL OR length(_base) < 3 THEN
    _base := 'ciclista';
  END IF;
  _base := left(_base, 12);
  LOOP
    _i := _i + 1;
    _try := _base || (floor(random() * 9000) + 1000)::int::text;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE lower(nickname) = _try);
    IF _i > 50 THEN
      _try := _base || replace(gen_random_uuid()::text, '-', '');
      _try := left(_try, 20);
      EXIT;
    END IF;
  END LOOP;
  RETURN _try;
END;
$$;

UPDATE public.profiles
   SET nickname = public.generate_nickname(COALESCE(full_name, 'ciclista'))
 WHERE nickname IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_nickname_lower_key ON public.profiles (lower(nickname));

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_nickname_format CHECK (
    nickname IS NULL OR nickname ~ '^[A-Za-z0-9_.]{3,20}$'
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_code text;
  _company_id uuid;
  _signup_kind text;
  _name text;
BEGIN
  _signup_kind := COALESCE(NEW.raw_user_meta_data->>'signup_kind', 'user');
  _company_code := NEW.raw_user_meta_data->>'company_code';

  IF _company_code IS NOT NULL AND length(_company_code) > 0 THEN
    SELECT id INTO _company_id FROM public.companies WHERE code = upper(_company_code) LIMIT 1;
  END IF;

  _name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);

  INSERT INTO public.profiles (id, full_name, phone, company_id, nickname)
  VALUES (
    NEW.id,
    _name,
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    _company_id,
    public.generate_nickname(_name)
  );

  IF _signup_kind = 'company_manager' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'company_manager');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  INSERT INTO public.wallets (user_id) VALUES (NEW.id);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.company_leaderboard(_company_id uuid)
RETURNS TABLE(user_id uuid, full_name text, lifetime_points integer, lifetime_km numeric, current_streak integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id,
         COALESCE(p.nickname, 'ciclista') AS full_name,
         COALESCE(w.lifetime_points, 0)::int,
         COALESCE(w.lifetime_km, 0),
         COALESCE(s.current_days, 0)::int
    FROM public.profiles p
    LEFT JOIN public.wallets w ON w.user_id = p.id
    LEFT JOIN public.streaks s ON s.user_id = p.id
   WHERE p.company_id = _company_id
   ORDER BY COALESCE(w.lifetime_points, 0) DESC
   LIMIT 50;
$$;