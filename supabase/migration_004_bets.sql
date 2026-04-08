-- ClearTheDeck: Pre-Game Spending Bets RPCs
-- Run AFTER migration.sql in Supabase SQL Editor.
-- The guesses table already exists in per-household schemas.

-----------------------------------------------------------------------
-- Submit bets for a month (upserts per category)
-----------------------------------------------------------------------
create or replace function public.submit_bets(
  p_household_id uuid,
  p_month text,
  p_bets jsonb
) returns void as $$
declare
  v_schema text;
  v_month date;
begin
  v_schema := public._resolve_household_schema(p_household_id);
  v_month := (p_month || '-01')::date;

  execute format($q$
    DELETE FROM %I.guesses
    WHERE user_id = $1 AND month = $2
  $q$, v_schema) using auth.uid(), v_month;

  execute format($q$
    INSERT INTO %I.guesses (user_id, month, category, predicted_amount)
    SELECT $1, $2, elem->>'category', (elem->>'predicted_amount')::numeric
    FROM jsonb_array_elements($3) AS elem
  $q$, v_schema) using auth.uid(), v_month, p_bets;
end;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- Get bets for a user + month
-----------------------------------------------------------------------
create or replace function public.get_my_bets(
  p_household_id uuid,
  p_month text
) returns table(
  id uuid,
  user_id uuid,
  month date,
  category text,
  predicted_amount numeric,
  created_at timestamptz
) as $$
declare
  v_schema text;
  v_month date;
begin
  v_schema := public._resolve_household_schema(p_household_id);
  v_month := (p_month || '-01')::date;

  return query execute format($q$
    SELECT id, user_id, month, category, predicted_amount, created_at
    FROM %I.guesses
    WHERE user_id = $1 AND month = $2
    ORDER BY category
  $q$, v_schema) using auth.uid(), v_month;
end;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- Get all household bets for a month (for comparison)
-----------------------------------------------------------------------
create or replace function public.get_household_bets(
  p_household_id uuid,
  p_month text
) returns table(
  user_id uuid,
  display_name text,
  category text,
  predicted_amount numeric
) as $$
declare
  v_schema text;
  v_month date;
begin
  v_schema := public._resolve_household_schema(p_household_id);
  v_month := (p_month || '-01')::date;

  return query execute format($q$
    SELECT g.user_id, p.display_name, g.category, g.predicted_amount
    FROM %I.guesses g
    JOIN public.profiles p ON p.id = g.user_id
    WHERE g.month = $1
    ORDER BY p.display_name, g.category
  $q$, v_schema) using v_month;
end;
$$ language plpgsql security definer;
