-- Recent panel: optional filter by card (account_last4) on classified-at date range.
-- Replaces the 3-arg signature from migration_023.

DROP FUNCTION IF EXISTS public.get_transactions_classified_in_date_range(uuid, date, date);

CREATE OR REPLACE FUNCTION public.get_transactions_classified_in_date_range(
  p_household_id uuid,
  p_from date,
  p_to date,
  p_account_last4 text DEFAULT NULL
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
    SELECT t.id, t.uploaded_by, t.merchant_raw, t.merchant_clean,
           t.amount, t.tx_date, t.billing_month, t.account_last4,
           t.category, t.status, t.classified_by, t.batch_id, t.user_note, t.created_at,
           t.classified_at
    FROM %I.transactions t
    WHERE t.classified_at IS NOT NULL
      AND t.status IN ('manual', 'auto', 'transfer')
      AND t.classified_at::date >= $1::date
      AND t.classified_at::date <= $2::date
      AND (
        trim(coalesce($3::text, '')) = ''
        OR trim(coalesce(t.account_last4, '')) = trim($3::text)
      )
    ORDER BY t.classified_at DESC
    LIMIT 500
  $q$, v_schema) USING v_from, v_to, p_account_last4;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_transactions_classified_in_date_range(uuid, date, date, text) TO authenticated;
