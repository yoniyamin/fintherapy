-- Set billing_month from tx_date for rows where they diverge (e.g. legacy bug or manual fixes).
-- Matches upload behavior (billing_month = first 7 chars of ISO date).
-- Apply after migration_021.

CREATE OR REPLACE FUNCTION public.sync_billing_month_from_tx_date(
  p_household_id uuid
) RETURNS bigint AS $$
DECLARE
  v_schema text;
  v_count bigint;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    UPDATE %I.transactions
    SET billing_month = to_char(tx_date, 'YYYY-MM')
    WHERE billing_month IS DISTINCT FROM to_char(tx_date, 'YYYY-MM')
  $q$, v_schema);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.sync_billing_month_from_tx_date(uuid) TO authenticated;
