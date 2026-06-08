-- Debit spend normalization + opposite-sign import dedup.
-- Run after migration_026.

-----------------------------------------------------------------------
-- 1. Fix debit normalization: bank CSV uses negative for outflows (same
--    as credit). Positive debit rows are card loads (own_transfers).
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._normalized_spend(
  p_amount numeric,
  p_account_type text
) RETURNS numeric AS $$
BEGIN
  IF p_account_type IN ('credit', 'debit') THEN
    RETURN -p_amount;
  ELSE
    RETURN ABS(p_amount);
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-----------------------------------------------------------------------
-- 2. Dedup imports: reject opposite-sign twins (re-upload with flipped
--    CSV sign convention). Still keyed by card + date + merchant.
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.insert_transactions(
  p_household_id uuid,
  p_rows jsonb
) RETURNS int AS $$
DECLARE
  v_schema text;
  v_count int;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    INSERT INTO %I.transactions
      (uploaded_by, merchant_raw, amount, tx_date, billing_month, account_last4, status)
    SELECT
      (elem->>'uploaded_by')::uuid,
      elem->>'merchant_raw',
      (elem->>'amount')::numeric,
      (elem->>'tx_date')::date,
      elem->>'billing_month',
      nullif(elem->>'account_last4', ''),
      'pending'
    FROM jsonb_array_elements($1) AS elem
    WHERE NOT EXISTS (
      SELECT 1 FROM %I.transactions existing
      WHERE existing.merchant_raw = elem->>'merchant_raw'
        AND existing.tx_date = (elem->>'tx_date')::date
        AND existing.billing_month = elem->>'billing_month'
        AND COALESCE(existing.account_last4, '') = COALESCE(nullif(elem->>'account_last4', ''), '')
        AND (
          existing.amount = (elem->>'amount')::numeric
          OR ABS(existing.amount) = ABS((elem->>'amount')::numeric)
        )
    )
  $q$, v_schema, v_schema) USING p_rows;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public._normalized_spend(numeric, text) TO authenticated;
