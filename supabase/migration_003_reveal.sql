-- ClearTheDeck: Big Reveal + Leaderboard RPCs
-- Run AFTER migration.sql and migration_002 in Supabase SQL Editor.

-----------------------------------------------------------------------
-- Monthly spending by category
-----------------------------------------------------------------------
create or replace function public.get_monthly_summary(
  p_household_id uuid,
  p_billing_month text
) returns table(
  category text,
  total_amount numeric,
  tx_count bigint
) as $$
declare
  v_schema text;
begin
  v_schema := public._resolve_household_schema(p_household_id);

  return query execute format($q$
    SELECT category, SUM(amount) as total_amount, COUNT(*) as tx_count
    FROM %I.transactions
    WHERE billing_month = $1
      AND status IN ('manual', 'auto')
      AND category IS NOT NULL
    GROUP BY category
    ORDER BY total_amount DESC
  $q$, v_schema) using p_billing_month;
end;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- Household leaderboard (XP + classification counts)
-----------------------------------------------------------------------
create or replace function public.get_household_leaderboard(
  p_household_id uuid
) returns table(
  user_id uuid,
  display_name text,
  avatar_url text,
  total_xp int,
  classified_count bigint
) as $$
declare
  v_schema text;
begin
  v_schema := public._resolve_household_schema(p_household_id);

  return query execute format($q$
    SELECT
      p.id as user_id,
      p.display_name,
      p.avatar_url,
      p.total_xp,
      COALESCE(counts.cnt, 0) as classified_count
    FROM public.profiles p
    LEFT JOIN (
      SELECT classified_by, COUNT(*) as cnt
      FROM %I.transactions
      WHERE status IN ('manual', 'auto') AND classified_by IS NOT NULL
      GROUP BY classified_by
    ) counts ON counts.classified_by = p.id
    WHERE p.household_id = $1
    ORDER BY p.total_xp DESC
  $q$, v_schema) using p_household_id;
end;
$$ language plpgsql security definer;
