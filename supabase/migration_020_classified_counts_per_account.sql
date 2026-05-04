-- Classify screen: per-member classification counts for one card (last4).
-- Apply after migration_019.

CREATE OR REPLACE FUNCTION public.get_classified_counts_for_account(
  p_household_id uuid,
  p_account_last4 text
) RETURNS TABLE(
  user_id uuid,
  display_name text,
  classified_count bigint
) AS $$
DECLARE
  v_schema text;
  v_last4 text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);
  v_last4 := trim(coalesce(p_account_last4, ''));

  RETURN QUERY EXECUTE format($q$
    SELECT
      p.id AS user_id,
      p.display_name,
      COALESCE(cnt.n, 0)::bigint AS classified_count
    FROM public.profiles p
    LEFT JOIN (
      SELECT t.classified_by AS uid, COUNT(*)::bigint AS n
      FROM %I.transactions t
      WHERE trim(coalesce(t.account_last4, '')) = $1
        AND t.status IN ('manual', 'auto', 'transfer')
        AND t.classified_by IS NOT NULL
      GROUP BY t.classified_by
    ) cnt ON cnt.uid = p.id
    WHERE p.household_id = $2
    ORDER BY classified_count DESC, p.display_name
  $q$, v_schema) USING v_last4, p_household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_classified_counts_for_account(uuid, text) TO authenticated;
