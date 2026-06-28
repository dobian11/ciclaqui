ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS tracking_start time,
  ADD COLUMN IF NOT EXISTS tracking_end time,
  ADD COLUMN IF NOT EXISTS tracking_days smallint[] DEFAULT ARRAY[1,2,3,4,5]::smallint[];