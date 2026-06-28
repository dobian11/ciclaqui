
DO $$ BEGIN
  CREATE TYPE public.company_kind AS ENUM ('company', 'municipality');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS kind public.company_kind NOT NULL DEFAULT 'company';
