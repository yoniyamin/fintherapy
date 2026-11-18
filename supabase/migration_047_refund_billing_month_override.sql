DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schema_name FROM public.households LOOP
    EXECUTE format($q$
      ALTER TABLE %I.transactions
      ADD COLUMN IF NOT EXISTS billing_month_overridden boolean NOT NULL DEFAULT false
    $q$, r.schema_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public._validate_billing_month(p_billing_month text)
RETURNS void AS $$
BEGIN
  IF p_billing_month IS NOT NULL AND p_billing_month !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'billing_month must look like YYYY-MM';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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
    WHERE NOT billing_month_overridden
      AND billing_month IS DISTINCT FROM to_char(tx_date, 'YYYY-MM')
  $q$, v_schema);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.insert_transactions(p_household_id uuid, p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
$function$;

DROP FUNCTION IF EXISTS public.classify_transactions_batch(uuid, uuid[], text);

CREATE OR REPLACE FUNCTION public.classify_transactions_batch(
  p_household_id uuid,
  p_tx_ids uuid[],
  p_category text,
  p_billing_month text DEFAULT NULL
) RETURNS int AS $$
DECLARE
  v_schema text;
  v_count int;
  v_expected int;
BEGIN
  PERFORM public._validate_billing_month(p_billing_month);
  v_schema := public._resolve_household_schema(p_household_id);
  v_expected := coalesce(array_length(p_tx_ids, 1), 0);

  EXECUTE format($q$
    UPDATE %I.transactions
    SET category = $1,
        status = 'manual',
        classified_by = $2,
        classified_at = now(),
        billing_month = COALESCE($4, billing_month),
        billing_month_overridden = billing_month_overridden OR $4 IS NOT NULL
    WHERE id = ANY($3)
      AND status IN ('pending', 'auto', 'flagged')
  $q$, v_schema) USING p_category, auth.uid(), p_tx_ids, p_billing_month;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count != v_expected THEN
    RAISE EXCEPTION 'Batch classify partial: expected %, updated %', v_expected, v_count;
  END IF;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS public.reclassify_transactions_batch(uuid, uuid[], text);

CREATE OR REPLACE FUNCTION public.reclassify_transactions_batch(
  p_household_id uuid,
  p_tx_ids uuid[],
  p_new_category text,
  p_billing_month text DEFAULT NULL
) RETURNS int AS $$
DECLARE
  v_schema text;
  v_count int;
  v_expected int;
BEGIN
  PERFORM public._validate_billing_month(p_billing_month);
  v_schema := public._resolve_household_schema(p_household_id);
  v_expected := coalesce(array_length(p_tx_ids, 1), 0);

  EXECUTE format($q$
    UPDATE %I.transactions
    SET category = $1,
        classified_by = $2,
        status = 'manual',
        classified_at = now(),
        billing_month = COALESCE($4, billing_month),
        billing_month_overridden = billing_month_overridden OR $4 IS NOT NULL
    WHERE id = ANY($3)
  $q$, v_schema) USING p_new_category, auth.uid(), p_tx_ids, p_billing_month;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count != v_expected THEN
    RAISE EXCEPTION 'Batch reclassify partial: expected %, updated %', v_expected, v_count;
  END IF;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.classify_transactions_split(
  p_household_id uuid,
  p_assignments jsonb,
  p_reclassify boolean DEFAULT false
) RETURNS uuid[] AS $$
DECLARE
  v_schema text;
  v_updated uuid[];
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  IF jsonb_typeof(p_assignments) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_assignments must be a JSON array';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_assignments) AS a(tx_id uuid, category text)
    WHERE a.tx_id IS NULL OR coalesce(btrim(a.category), '') = ''
  ) THEN
    RAISE EXCEPTION 'Every assignment needs a tx_id and a non-empty category';
  END IF;

  IF (
    SELECT count(*) <> count(DISTINCT a.tx_id)
    FROM jsonb_to_recordset(p_assignments) AS a(tx_id uuid, category text)
  ) THEN
    RAISE EXCEPTION 'Duplicate tx_id in assignments';
  END IF;

  PERFORM public._validate_billing_month(nullif(btrim(a.billing_month), ''))
  FROM jsonb_to_recordset(p_assignments) AS a(tx_id uuid, category text, billing_month text);

  EXECUTE format($q$
    WITH assignments AS (
      SELECT a.tx_id, btrim(a.category) AS category, nullif(btrim(a.billing_month), '') AS billing_month
      FROM jsonb_to_recordset($1) AS a(tx_id uuid, category text, billing_month text)
    ),
    updated AS (
      UPDATE %I.transactions t
      SET category = assignments.category,
          status = 'manual',
          classified_by = $2,
          classified_at = now(),
          billing_month = COALESCE(assignments.billing_month, t.billing_month),
          billing_month_overridden = t.billing_month_overridden OR assignments.billing_month IS NOT NULL
      FROM assignments
      WHERE t.id = assignments.tx_id
        AND ($3 OR t.status IN ('pending', 'auto', 'flagged'))
      RETURNING t.id
    )
    SELECT coalesce(array_agg(id), '{}'::uuid[]) FROM updated
  $q$, v_schema) INTO v_updated USING p_assignments, auth.uid(), p_reclassify;

  RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.revert_to_pending(
  p_household_id uuid,
  p_tx_id uuid
) RETURNS void AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    UPDATE %I.transactions
    SET status = 'pending',
        category = NULL,
        classified_by = NULL,
        classified_at = NULL,
        billing_month = CASE WHEN billing_month_overridden THEN to_char(tx_date, 'YYYY-MM') ELSE billing_month END,
        billing_month_overridden = false
    WHERE id = $1
  $q$, v_schema) USING p_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.revert_to_pending_batch(
  p_household_id uuid,
  p_tx_ids uuid[]
) RETURNS int AS $$
DECLARE
  v_schema text;
  v_count int;
  v_expected int;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);
  v_expected := coalesce(array_length(p_tx_ids, 1), 0);

  EXECUTE format($q$
    UPDATE %I.transactions
    SET status = 'pending',
        category = NULL,
        classified_by = NULL,
        classified_at = NULL,
        billing_month = CASE WHEN billing_month_overridden THEN to_char(tx_date, 'YYYY-MM') ELSE billing_month END,
        billing_month_overridden = false
    WHERE id = ANY($1)
  $q$, v_schema) USING p_tx_ids;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count != v_expected THEN
    RAISE EXCEPTION 'Batch revert partial: expected %, updated %', v_expected, v_count;
  END IF;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.classify_transactions_batch(uuid, uuid[], text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reclassify_transactions_batch(uuid, uuid[], text, text) TO authenticated;
