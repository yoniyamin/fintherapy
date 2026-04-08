-- ClearTheDeck: Reveal v2 — Monthly totals + Household income
-- Run AFTER migration_003_reveal.sql in Supabase SQL Editor.

-----------------------------------------------------------------------
-- Add monthly_income column to households
-----------------------------------------------------------------------
ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS monthly_income numeric(10,2);

-----------------------------------------------------------------------
-- Set household income (any member can update)
-----------------------------------------------------------------------
create or replace function public.set_household_income(
  p_household_id uuid,
  p_income numeric
) returns void as $$
declare
  v_schema text;
begin
  v_schema := public._resolve_household_schema(p_household_id);

  UPDATE public.households
  SET monthly_income = p_income
  WHERE id = p_household_id;
end;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- Get household income
-----------------------------------------------------------------------
create or replace function public.get_household_income(
  p_household_id uuid
) returns numeric as $$
declare
  v_schema text;
  v_income numeric;
begin
  v_schema := public._resolve_household_schema(p_household_id);

  SELECT monthly_income INTO v_income
  FROM public.households
  WHERE id = p_household_id;

  return v_income;
end;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- Get monthly totals across all billing months
-----------------------------------------------------------------------
create or replace function public.get_monthly_totals(
  p_household_id uuid
) returns table(
  billing_month text,
  total_amount numeric,
  tx_count bigint
) as $$
declare
  v_schema text;
begin
  v_schema := public._resolve_household_schema(p_household_id);

  return query execute format($q$
    SELECT billing_month, SUM(amount) as total_amount, COUNT(*) as tx_count
    FROM %I.transactions
    WHERE status IN ('manual', 'auto')
      AND category IS NOT NULL
    GROUP BY billing_month
    ORDER BY billing_month ASC
  $q$, v_schema);
end;
$$ language plpgsql security definer;
