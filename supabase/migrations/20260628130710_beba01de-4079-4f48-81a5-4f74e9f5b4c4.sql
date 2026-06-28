
-- Add IBAN + stripe connect placeholders to profiles for payout destination
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_account_status text;

-- Snapshot IBAN on the payout request at creation time
ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS iban_snapshot text;
