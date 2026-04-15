-- 1) Dedup must include account_last4: same CSV for a different card was skipped as duplicate
--     (only merchant, amount, date, month matched). After this, re-upload the file with the new last-4.
-- 2) All distinct last-4 values seen in any transaction (for upload / reveal pickers).

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
        AND existing.amount = (elem->>'amount')::numeric
        AND existing.tx_date = (elem->>'tx_date')::date
        AND existing.billing_month = elem->>'billing_month'
        AND COALESCE(existing.account_last4, '') = COALESCE(nullif(elem->>'account_last4', ''), '')
    )
  $q$, v_schema, v_schema) USING p_rows;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_distinct_account_last4_for_household(
  p_household_id uuid
) RETURNS TABLE(account_last4 text) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT DISTINCT t.account_last4::text
    FROM %I.transactions t
    WHERE t.account_last4 IS NOT NULL
      AND trim(t.account_last4) <> ''
    ORDER BY 1
  $q$, v_schema);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
