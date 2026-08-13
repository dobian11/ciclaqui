CREATE TABLE public.company_wallets (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  balance_eur numeric NOT NULL DEFAULT 0,
  lifetime_topup_eur numeric NOT NULL DEFAULT 0,
  lifetime_paid_eur numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_wallets TO authenticated;
GRANT ALL ON public.company_wallets TO service_role;
ALTER TABLE public.company_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own company wallet" ON public.company_wallets
  FOR SELECT TO authenticated USING (public.owns_company(company_id) OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_company_wallets_updated_at BEFORE UPDATE ON public.company_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.company_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount_eur numeric NOT NULL CHECK (amount_eur > 0),
  method text NOT NULL DEFAULT 'bank_transfer' CHECK (method IN ('bank_transfer','card')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','canceled')),
  reference text,
  notes text,
  created_by uuid,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.company_topups TO authenticated;
GRANT ALL ON public.company_topups TO service_role;
ALTER TABLE public.company_topups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own topups" ON public.company_topups
  FOR SELECT TO authenticated USING (public.owns_company(company_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner creates own topups" ON public.company_topups
  FOR INSERT TO authenticated WITH CHECK (public.owns_company(company_id) AND created_by = auth.uid() AND status = 'pending');
CREATE TRIGGER update_company_topups_updated_at BEFORE UPDATE ON public.company_topups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_company_topups_company ON public.company_topups(company_id, created_at DESC);

CREATE TABLE public.company_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  delta_eur numeric NOT NULL,
  kind text NOT NULL CHECK (kind IN ('topup','payout','adjustment')),
  payout_id uuid REFERENCES public.payout_requests(id) ON DELETE SET NULL,
  topup_id uuid REFERENCES public.company_topups(id) ON DELETE SET NULL,
  user_id uuid,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_wallet_transactions TO authenticated;
GRANT ALL ON public.company_wallet_transactions TO service_role;
ALTER TABLE public.company_wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own wallet movements" ON public.company_wallet_transactions
  FOR SELECT TO authenticated USING (public.owns_company(company_id) OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_company_wallet_tx_company ON public.company_wallet_transactions(company_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.confirm_company_topup(_topup_id uuid, _actor uuid)
RETURNS public.company_topups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _t public.company_topups%ROWTYPE;
BEGIN
  SELECT * INTO _t FROM public.company_topups WHERE id = _topup_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ricarica non trovata'; END IF;
  IF _t.status <> 'pending' THEN RAISE EXCEPTION 'Ricarica gia gestita'; END IF;

  INSERT INTO public.company_wallets(company_id) VALUES (_t.company_id)
  ON CONFLICT (company_id) DO NOTHING;

  UPDATE public.company_wallets
     SET balance_eur = balance_eur + _t.amount_eur,
         lifetime_topup_eur = lifetime_topup_eur + _t.amount_eur,
         updated_at = now()
   WHERE company_id = _t.company_id;

  UPDATE public.company_topups
     SET status = 'completed', confirmed_by = _actor, confirmed_at = now()
   WHERE id = _t.id
   RETURNING * INTO _t;

  INSERT INTO public.company_wallet_transactions(company_id, delta_eur, kind, topup_id, note, created_by)
  VALUES (_t.company_id, _t.amount_eur, 'topup', _t.id, 'Ricarica ' || _t.method, _actor);

  RETURN _t;
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_payout_from_company(_payout_id uuid, _company_id uuid, _actor uuid)
RETURNS public.payout_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _p public.payout_requests%ROWTYPE;
  _w public.company_wallets%ROWTYPE;
  _member_company uuid;
BEGIN
  SELECT * INTO _p FROM public.payout_requests WHERE id = _payout_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Richiesta non trovata'; END IF;
  IF _p.status NOT IN ('pending','approved') THEN RAISE EXCEPTION 'Richiesta gia gestita'; END IF;

  SELECT company_id INTO _member_company FROM public.profiles WHERE id = _p.user_id;
  IF _member_company IS DISTINCT FROM _company_id THEN
    RAISE EXCEPTION 'La richiesta non appartiene a questo ente';
  END IF;

  INSERT INTO public.company_wallets(company_id) VALUES (_company_id)
  ON CONFLICT (company_id) DO NOTHING;

  SELECT * INTO _w FROM public.company_wallets WHERE company_id = _company_id FOR UPDATE;
  IF _w.balance_eur < _p.amount_eur THEN
    RAISE EXCEPTION 'Saldo insufficiente: ricarica il conto ente';
  END IF;

  UPDATE public.company_wallets
     SET balance_eur = balance_eur - _p.amount_eur,
         lifetime_paid_eur = lifetime_paid_eur + _p.amount_eur,
         updated_at = now()
   WHERE company_id = _company_id;

  UPDATE public.payout_requests
     SET status = 'paid', reviewed_by = _actor, reviewed_at = now(), updated_at = now()
   WHERE id = _p.id
   RETURNING * INTO _p;

  INSERT INTO public.company_wallet_transactions(company_id, delta_eur, kind, payout_id, user_id, note, created_by)
  VALUES (_company_id, -_p.amount_eur, 'payout', _p.id, _p.user_id, 'Pagamento prelievo dipendente', _actor);

  INSERT INTO public.user_notifications(user_id, type, title, body, company_id, payload)
  VALUES (_p.user_id, 'payout_paid', 'Prelievo pagato',
          'Il tuo ente ha effettuato il bonifico di € ' || to_char(_p.amount_eur, 'FM999999990.00') || ' sul tuo IBAN.',
          _company_id, jsonb_build_object('payout_id', _p.id));

  RETURN _p;
END;
$$;

INSERT INTO public.company_wallets(company_id)
SELECT id FROM public.companies ON CONFLICT (company_id) DO NOTHING;