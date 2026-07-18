-- Add last_classified_at to get_month_classification_stats
-- so the frontend can gate the celebration screen to the day
-- classification was completed.

CREATE OR REPLACE FUNCTION public.get_month_classification_stats(
  p_household_id uuid,
  p_billing_month text
) RETURNS table(
  total_count bigint,
  classified_count bigint,
  pending_count bigint,
  transfer_count bigint,
  offset_count bigint,
  flagged_count bigint,
  last_classified_at timestamptz
) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT
      COUNT(*) AS total_count,
      COUNT(*) FILTER (WHERE status IN ('manual', 'auto')) AS classified_count,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
      COUNT(*) FILTER (WHERE status = 'transfer') AS transfer_count,
      COUNT(*) FILTER (WHERE status = 'offset') AS offset_count,
      COUNT(*) FILTER (WHERE status = 'flagged') AS flagged_count,
      MAX(classified_at) FILTER (WHERE status IN ('manual', 'auto', 'transfer', 'offset', 'flagged'))
        AS last_classified_at
    FROM %I.transactions
    WHERE billing_month = $1
  $q$, v_schema) USING p_billing_month;
END;
$$ language plpgsql security definer;
