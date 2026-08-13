create or replace function public.prevent_trip_fraud_column_updates()
returns trigger
language plpgsql
set search_path = public
as $$
begin
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

create or replace function public.prevent_wallet_balance_updates()
returns trigger
language plpgsql
set search_path = public
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
