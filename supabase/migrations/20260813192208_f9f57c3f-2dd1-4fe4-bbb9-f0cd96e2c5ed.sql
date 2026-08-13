CREATE OR REPLACE FUNCTION public.prevent_wallet_balance_tamper()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.points_balance IS DISTINCT FROM OLD.points_balance
     OR NEW.eur_balance IS DISTINCT FROM OLD.eur_balance
     OR NEW.lifetime_points IS DISTINCT FROM OLD.lifetime_points
     OR NEW.lifetime_km IS DISTINCT FROM OLD.lifetime_km
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Wallet balances can only be changed by the system';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_wallet_balance_tamper ON public.wallets;
CREATE TRIGGER prevent_wallet_balance_tamper
BEFORE UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.prevent_wallet_balance_tamper();