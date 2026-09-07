-- 1) Valore punti: 500 punti = 10 €
UPDATE public.app_config SET eur_per_point = 0.02, payout_threshold_eur = 10, updated_at = now() WHERE id = 1;

-- 2) Listino servizi Doctorbike acquistabili dagli enti
CREATE TABLE IF NOT EXISTS public.doctorbike_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'service',
  price_eur numeric(10,2) NOT NULL CHECK (price_eur >= 0),
  suggested_points integer NOT NULL DEFAULT 500 CHECK (suggested_points >= 0),
  image_url text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.doctorbike_catalog TO authenticated;
GRANT ALL ON public.doctorbike_catalog TO service_role;

ALTER TABLE public.doctorbike_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Catalogo Doctorbike visibile agli utenti" ON public.doctorbike_catalog;
CREATE POLICY "Catalogo Doctorbike visibile agli utenti"
  ON public.doctorbike_catalog FOR SELECT TO authenticated USING (active = true);

DROP TRIGGER IF EXISTS doctorbike_catalog_updated_at ON public.doctorbike_catalog;
CREATE TRIGGER doctorbike_catalog_updated_at
  BEFORE UPDATE ON public.doctorbike_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.doctorbike_catalog (title, description, category, price_eur, suggested_points, sort_order)
SELECT * FROM (VALUES
  ('Tagliando Premium', 'Revisione completa della bici presso i centri Doctorbike Italia: trasmissione, freni, cambio, ruote e messa a punto.', 'service', 79.00, 3500, 10),
  ('Tagliando Basic', 'Controllo di sicurezza e messa a punto base della bici nei centri Doctorbike Italia.', 'service', 39.00, 2000, 20),
  ('Caschetto bici', 'Casco omologato da ritirare in un centro Doctorbike Italia.', 'product', 10.00, 500, 30),
  ('Kit riparazione forature', 'Kit completo camera d''aria, leve e pompa tascabile.', 'product', 20.00, 1000, 40),
  ('Buono sconto acquisto bici', 'Buono da utilizzare sull''acquisto di una bici nuova nei centri Doctorbike Italia.', 'voucher', 100.00, 5000, 50),
  ('Buono sconto monopattino', 'Buono da utilizzare sull''acquisto di un monopattino nei centri Doctorbike Italia.', 'voucher', 50.00, 2500, 60)
) AS v(title, description, category, price_eur, suggested_points, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.doctorbike_catalog);

-- 3) Acquisto di un servizio dal listino con il conto prepagato dell'ente
CREATE OR REPLACE FUNCTION public.purchase_doctorbike_item(
  _company_id uuid,
  _item_id uuid,
  _qty integer,
  _points_cost integer,
  _actor uuid
)
RETURNS public.rewards_catalog
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _item public.doctorbike_catalog%ROWTYPE;
  _wallet public.company_wallets%ROWTYPE;
  _total numeric(12,2);
  _reward public.rewards_catalog%ROWTYPE;
BEGIN
  IF _qty IS NULL OR _qty < 1 OR _qty > 500 THEN RAISE EXCEPTION 'Quantita non valida'; END IF;
  IF _points_cost IS NULL OR _points_cost < 500 THEN RAISE EXCEPTION 'Il punteggio richiesto deve essere almeno 500'; END IF;

  SELECT * INTO _item FROM public.doctorbike_catalog WHERE id = _item_id AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Servizio non disponibile'; END IF;

  _total := round(_item.price_eur * _qty, 2);

  INSERT INTO public.company_wallets(company_id) VALUES (_company_id)
  ON CONFLICT (company_id) DO NOTHING;

  SELECT * INTO _wallet FROM public.company_wallets WHERE company_id = _company_id FOR UPDATE;
  IF _wallet.balance_eur < _total THEN
    RAISE EXCEPTION 'Saldo insufficiente: servono % euro', _total;
  END IF;

  UPDATE public.company_wallets
     SET balance_eur = balance_eur - _total,
         lifetime_paid_eur = lifetime_paid_eur + _total,
         updated_at = now()
   WHERE company_id = _company_id;

  INSERT INTO public.company_wallet_transactions(company_id, delta_eur, kind, note, created_by)
  VALUES (_company_id, -_total, 'reward_purchase',
          'Acquisto ' || _qty || 'x ' || _item.title || ' (Doctorbike)', _actor);

  SELECT * INTO _reward FROM public.rewards_catalog
   WHERE company_id = _company_id
     AND partner = 'Doctorbike Italia'
     AND title = _item.title
     AND points_cost = _points_cost
   LIMIT 1;

  IF FOUND THEN
    UPDATE public.rewards_catalog
       SET stock = COALESCE(stock, 0) + _qty,
           active = true,
           cash_value_eur = _item.price_eur,
           updated_at = now()
     WHERE id = _reward.id
     RETURNING * INTO _reward;
  ELSE
    INSERT INTO public.rewards_catalog(
      title, description, partner, category, points_cost, cash_value_eur,
      stock, terms, active, scope, company_id
    ) VALUES (
      _item.title, _item.description, 'Doctorbike Italia', _item.category,
      _points_cost, _item.price_eur, _qty,
      'Riscattabile entro 12 mesi presso tutti i centri Doctorbike Italia mostrando l''email di conferma.',
      true, 'company', _company_id
    ) RETURNING * INTO _reward;
  END IF;

  RETURN _reward;
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_doctorbike_item(uuid, uuid, integer, integer, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_doctorbike_item(uuid, uuid, integer, integer, uuid) TO service_role;

-- 4) Riscatto: soglia minima 500 punti e validita 12 mesi
CREATE OR REPLACE FUNCTION public.redeem_reward_for_user(_user_id uuid, _reward_id uuid)
RETURNS reward_redemptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _reward public.rewards_catalog%ROWTYPE;
  _wallet public.wallets%ROWTYPE;
  _profile public.profiles%ROWTYPE;
  _redemption public.reward_redemptions%ROWTYPE;
  _open integer;
  _min_points integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Autenticazione richiesta'; END IF;

  SELECT * INTO _reward FROM public.rewards_catalog
  WHERE id = _reward_id AND active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Premio non disponibile'; END IF;

  SELECT * INTO _profile FROM public.profiles WHERE id = _user_id;
  IF _reward.company_id IS NOT NULL AND _reward.company_id IS DISTINCT FROM _profile.company_id THEN
    RAISE EXCEPTION 'Premio non disponibile per il tuo ente';
  END IF;

  IF _reward.stock IS NOT NULL AND _reward.stock <= 0 THEN
    RAISE EXCEPTION 'Premio esaurito';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reward_redemptions r
     WHERE r.user_id = _user_id
       AND r.reward_id = _reward_id
       AND r.status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Hai già riscattato questo premio';
  END IF;

  SELECT GREATEST(500, ceil(payout_threshold_eur / NULLIF(eur_per_point, 0))::int)
    INTO _min_points FROM public.app_config WHERE id = 1;
  _min_points := COALESCE(_min_points, 500);

  SELECT * INTO _wallet FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND OR _wallet.points_balance < _min_points THEN
    RAISE EXCEPTION 'Servono almeno % punti per riscattare un premio', _min_points;
  END IF;
  IF _wallet.points_balance < _reward.points_cost THEN RAISE EXCEPTION 'Punti insufficienti'; END IF;

  IF _reward.category = 'cash' AND COALESCE(_reward.cash_value_eur, 0) > 0 THEN
    IF _profile.iban IS NULL OR length(_profile.iban) < 15 THEN
      RAISE EXCEPTION 'Aggiungi il tuo IBAN nel profilo per riscattare un premio in denaro';
    END IF;
    SELECT count(*) INTO _open FROM public.payout_requests
     WHERE user_id = _user_id AND status IN ('pending','approved');
    IF _open > 0 THEN
      RAISE EXCEPTION 'Hai già una richiesta di pagamento in corso: attendi che venga completata';
    END IF;
  END IF;

  UPDATE public.wallets SET points_balance = points_balance - _reward.points_cost WHERE user_id = _user_id;
  IF _reward.stock IS NOT NULL THEN
    UPDATE public.rewards_catalog SET stock = stock - 1 WHERE id = _reward.id;
  END IF;

  INSERT INTO public.point_transactions(user_id, delta_points, delta_eur, reason)
  VALUES (_user_id, -_reward.points_cost, 0, 'redeem:' || _reward.id);

  INSERT INTO public.reward_redemptions(user_id, reward_id, code, points_spent, status, expires_at)
  VALUES (_user_id, _reward.id, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
          _reward.points_cost, 'active', now() + interval '12 months')
  RETURNING * INTO _redemption;

  IF _reward.category = 'cash' AND COALESCE(_reward.cash_value_eur, 0) > 0 THEN
    INSERT INTO public.payout_requests(user_id, points_redeemed, amount_eur, status, iban_snapshot)
    VALUES (_user_id, _reward.points_cost, _reward.cash_value_eur, 'pending', _profile.iban);
  END IF;

  RETURN _redemption;
END;
$function$;
