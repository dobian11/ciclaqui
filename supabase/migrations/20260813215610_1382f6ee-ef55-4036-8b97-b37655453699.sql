-- Harden trips/wallets against privilege escalation: authenticated users must not
-- be able to overwrite fraud-relevant columns on their own rows.

-- Trips: distance, points, speed and anomaly fields are computed/reviewed server-side.
create or replace function public.prevent_trip_fraud_column_updates()
returns trigger
language plpgsql
as $$
begin
  -- Only authenticated end-user sessions are restricted. Service/admin calls
  -- (auth.uid() is null) can still update these columns for legitimate processing.
  if auth.uid() is null then
    return new;
  end if;

  if new.distance_km is distinct from old.distance_km
     or new.points_earned is distinct from old.points_earned
     or new.avg_speed_kmh is distinct from old.avg_speed_kmh
     or new.anomaly_flag is distinct from old.anomaly_flag
     or new.anomaly_reason is distinct from old.anomaly_reason
  then
    raise exception 'Modifica non autorizzata: i campi del viaggio sono calcolati lato server.'
      using hint = 'Trip fraud-sensitive columns cannot be updated by end users.';
  end if;

  return new;
end;
$$;

drop trigger if exists trips_block_fraud_update on public.trips;
create trigger trips_block_fraud_update
  before update on public.trips
  for each row
  execute function public.prevent_trip_fraud_column_updates();

-- Wallets: balance/lifetime columns must only move through the point_transactions
-- ledger and approved payout flows.
create or replace function public.prevent_wallet_balance_updates()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.points_balance is distinct from old.points_balance
     or new.eur_balance is distinct from old.eur_balance
     or new.lifetime_points is distinct from old.lifetime_points
     or new.lifetime_km is distinct from old.lifetime_km
  then
    raise exception 'Modifica non autorizzata: i saldi sono gestiti lato server.'
      using hint = 'Wallet balance columns cannot be updated by end users.';
  end if;

  return new;
end;
$$;

drop trigger if exists wallets_block_balance_update on public.wallets;
create trigger wallets_block_balance_update
  before update on public.wallets
  for each row
  execute function public.prevent_wallet_balance_updates();
