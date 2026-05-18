-- Recent panel: load classified actions between calendar dates (classified_at).
-- Include manual / auto / transfer rows with classified_at set. Caps row volume for safety.
-- Apply after migration_022.

CREATE OR REPLACE FUNCTION public.get_transactions_classified_in_date_range(
  p_household_id uuid,
  p_from date,
  p_to date
) RETURNS TABLE(
  id uuid,
  uploaded_by uuid,
  merchant_raw text,
  merchant_clean text,
  amount numeric,
  tx_date date,
  billing_month text,
  account_last4 text,
  category text,
  status text,
  classified_by uuid,
  batch_id uuid,
  user_note text,
  created_at timestamptz,
  classified_at timestamptz
) AS $$
DECLARE
  v_schema text;
  v_from date;
  v_to date;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);
  v_from := LEAST(p_from, p_to);
  v_to := GREATEST(p_from, p_to);

  RETURN QUERY EXECUTE format($q$
    SELECT id, uploaded_by, merchant_raw, merchant_clean,
           amount, tx_date, billing_month, account_last4,
           category, status, classified_by, batch_id, user_note, created_at,
           classified_at
    FROM %I.transactions
    WHERE classified_at IS NOT NULL
      AND status IN ('manual', 'auto', 'transfer')
      AND classified_at::date >= $1::date
      AND classified_at::date <= $2::date
    ORDER BY classified_at DESC
    LIMIT 500
  $q$, v_schema) USING v_from, v_to;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_transactions_classified_in_date_range(uuid, date, date) TO authenticated;
