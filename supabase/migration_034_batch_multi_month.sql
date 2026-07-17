BEGIN;

CREATE OR REPLACE FUNCTION get_multi_month_summary(
  p_household_id  UUID,
  p_months        TEXT[],
  p_account_last4s TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_schema TEXT;
  v_result JSONB := '[]'::JSONB;
  v_month  TEXT;
  v_rows   JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_schema := public._resolve_household_schema(p_household_id);

  FOREACH v_month IN ARRAY p_months LOOP
    EXECUTE format($q$
      SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb)
      FROM (
        SELECT
          t.category,
          COUNT(*)::int           AS count,
          SUM(ABS(t.amount))      AS total
        FROM %I.transactions t
        WHERE t.billing_month = $1
          AND t.status IN ('classified', 'auto')
          AND ($2::text[] IS NULL OR t.account_last4 = ANY($2))
        GROUP BY t.category
        ORDER BY SUM(ABS(t.amount)) DESC
      ) sub
    $q$, v_schema) INTO v_rows USING v_month, p_account_last4s;

    v_result := v_result || jsonb_build_object('month', v_month, 'categories', v_rows);
  END LOOP;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION get_multi_month_export(
  p_household_id UUID,
  p_months       TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_schema TEXT;
  v_result JSONB := '[]'::JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    SELECT COALESCE(jsonb_agg(row_to_json(t.*) ORDER BY t.tx_date, t.merchant_raw), '[]'::jsonb)
    FROM %I.transactions t
    WHERE t.billing_month = ANY($1)
      AND t.status IN ('classified', 'auto', 'own_transfer')
  $q$, v_schema) INTO v_result USING p_months;

  RETURN v_result;
END;
$$;

COMMIT;
