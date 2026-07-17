BEGIN;

CREATE OR REPLACE FUNCTION insert_transactions(
  p_household_id UUID,
  p_rows         JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_schema TEXT;
  v_count  INT;
  v_batch  UUID := gen_random_uuid();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    INSERT INTO %I.transactions
      (uploaded_by, merchant_raw, amount, tx_date, billing_month, account_last4, status, batch_id)
    SELECT
      $2,
      elem->>'merchant_raw',
      (elem->>'amount')::numeric,
      (elem->>'tx_date')::date,
      elem->>'billing_month',
      nullif(elem->>'account_last4', ''),
      'pending',
      $3
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
  $q$, v_schema, v_schema) USING p_rows, auth.uid(), v_batch;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('inserted', v_count, 'batch_id', v_batch);
END;
$$;

CREATE OR REPLACE FUNCTION delete_transactions_by_batch(
  p_household_id UUID,
  p_batch_id     UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.transactions t
   WHERE t.household_id = p_household_id
     AND t.batch_id     = p_batch_id
     AND t.uploaded_by  = auth.uid();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION delete_transactions_by_ids(
  p_household_id UUID,
  p_ids          UUID[]
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.transactions t
   WHERE t.household_id = p_household_id
     AND t.id = ANY(p_ids)
     AND t.uploaded_by = auth.uid();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMIT;
