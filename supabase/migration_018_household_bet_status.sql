-----------------------------------------------------------------------
-- Returns which household members placed bets for a given month,
-- and how many categories each bet on — WITHOUT exposing amounts.
-- Used so other members can see "X placed bets" before the reveal.
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_household_bet_status(
  p_household_id uuid,
  p_month text
) RETURNS table(
  user_id uuid,
  display_name text,
  avatar_url text,
  category_count bigint,
  is_current_user boolean
) AS $$
DECLARE
  v_schema text;
  v_month date;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);
  v_month := (p_month || '-01')::date;

  RETURN QUERY EXECUTE format($q$
    SELECT
      p.id                       AS user_id,
      p.display_name,
      p.avatar_url::text,
      COUNT(g.id)                AS category_count,
      (p.id = $2)                AS is_current_user
    FROM public.profiles p
    LEFT JOIN %I.guesses g ON g.user_id = p.id AND g.month = $1
    WHERE p.household_id = $3
    GROUP BY p.id, p.display_name, p.avatar_url
    ORDER BY p.display_name
  $q$, v_schema)
  USING v_month, auth.uid(), p_household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
