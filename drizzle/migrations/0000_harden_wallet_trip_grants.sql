-- Nessuna policy consente accesso anonimo a queste tabelle: togliamo anche i privilegi.
REVOKE ALL ON public.trips FROM anon;
REVOKE ALL ON public.wallets FROM anon;
REVOKE ALL ON public.company_wallets FROM anon;

-- I viaggi si creano solo lato server (calcolo punti anti-frode).
REVOKE INSERT ON public.trips FROM authenticated;

-- I saldi utente non sono mai modificabili dal client.
REVOKE UPDATE ON public.wallets FROM authenticated;

-- Il conto dell'ente è di sola lettura per titolari/admin.
REVOKE INSERT, UPDATE, DELETE ON public.company_wallets FROM authenticated;

GRANT SELECT ON public.company_wallets TO authenticated;
GRANT ALL ON public.trips TO service_role;
GRANT ALL ON public.wallets TO service_role;
GRANT ALL ON public.company_wallets TO service_role;
