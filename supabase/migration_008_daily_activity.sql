-- ClearTheDeck: Daily Activity Summary for Home Feed
-- Run AFTER all previous migrations in Supabase SQL Editor.

-----------------------------------------------------------------------
-- Daily activity summary (classifications, uploads, bets per user)
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_daily_activity_summary(
  p_household_id uuid,
  p_date date DEFAULT CURRENT_DATE
) RETURNS table(
  user_id uuid,
  display_name text,
  classified_today bigint,
  uploads_today bigint,
  bets_placed_today bigint
) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT
      p.id AS user_id,
      p.display_name,
      COALESCE(c.cnt, 0)::bigint AS classified_today,
      COALESCE(u.cnt, 0)::bigint AS uploads_today,
      COALESCE(b.cnt, 0)::bigint AS bets_placed_today
    FROM public.profiles p
    LEFT JOIN (
      SELECT classified_by, COUNT(*) AS cnt
      FROM %I.transactions
      WHERE status IN ('manual', 'auto', 'transfer')
        AND created_at::date = $1
        AND classified_by IS NOT NULL
      GROUP BY classified_by
    ) c ON c.classified_by = p.id
    LEFT JOIN (
      SELECT uploaded_by, COUNT(*) AS cnt
      FROM %I.transactions
      WHERE created_at::date = $1
        AND uploaded_by IS NOT NULL
      GROUP BY uploaded_by
    ) u ON u.uploaded_by = p.id
    LEFT JOIN (
      SELECT g.user_id, COUNT(DISTINCT g.month) AS cnt
      FROM %I.guesses g
      WHERE g.created_at::date = $1
      GROUP BY g.user_id
    ) b ON b.user_id = p.id
    WHERE p.household_id = $2
      AND (COALESCE(c.cnt, 0) > 0 OR COALESCE(u.cnt, 0) > 0 OR COALESCE(b.cnt, 0) > 0)
    ORDER BY COALESCE(c.cnt, 0) DESC, COALESCE(u.cnt, 0) DESC
  $q$, v_schema, v_schema, v_schema) USING p_date, p_household_id;
END;
$$ language plpgsql security definer;
