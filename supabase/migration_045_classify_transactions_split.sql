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

  EXECUTE format($q$
    WITH assignments AS (
      SELECT a.tx_id, btrim(a.category) AS category
      FROM jsonb_to_recordset($1) AS a(tx_id uuid, category text)
    ),
    updated AS (
      UPDATE %I.transactions t
      SET category = assignments.category,
          status = 'manual',
          classified_by = $2,
          classified_at = now()
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

GRANT EXECUTE ON FUNCTION public.classify_transactions_split(uuid, jsonb, boolean) TO authenticated;
