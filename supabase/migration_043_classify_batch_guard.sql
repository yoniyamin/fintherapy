-- migration_043_classify_batch_guard.sql
-- Defense-in-depth: batch RPCs raise on partial update + queue count RPC for truncation detection.
-- Deploy AFTER client count checks (Phase 1) so concurrent multi-user classify
-- does not hard-error before the client can handle it gracefully.

-- ============================================================
-- 1. classify_transactions_batch — add RAISE on partial update
-- ============================================================
CREATE OR REPLACE FUNCTION public.classify_transactions_batch(
  p_household_id uuid,
  p_tx_ids uuid[],
  p_category text
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
    SET category = $1,
        status = 'manual',
        classified_by = $2,
        classified_at = now()
    WHERE id = ANY($3)
      AND status IN ('pending', 'auto', 'flagged')
  $q$, v_schema) USING p_category, auth.uid(), p_tx_ids;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count != v_expected THEN
    RAISE EXCEPTION 'Batch classify partial: expected %, updated %', v_expected, v_count;
  END IF;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. confirm_auto_classified_batch — add RAISE on partial update
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_auto_classified_batch(
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
    SET status = 'manual',
        classified_by = $1,
        classified_at = now()
    WHERE id = ANY($2) AND status = 'auto'
  $q$, v_schema) USING auth.uid(), p_tx_ids;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count != v_expected THEN
    RAISE EXCEPTION 'Batch confirm partial: expected %, updated %', v_expected, v_count;
  END IF;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. flag_transactions_batch — add RAISE on partial update
-- ============================================================
CREATE OR REPLACE FUNCTION public.flag_transactions_batch(
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
    SET status = 'flagged'
    WHERE id = ANY($1)
      AND status IN ('pending', 'auto')
  $q$, v_schema) USING p_tx_ids;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count != v_expected THEN
    RAISE EXCEPTION 'Batch flag partial: expected %, updated %', v_expected, v_count;
  END IF;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. mark_as_transfer_batch — add RAISE on partial update
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_as_transfer_batch(
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
    SET status = 'transfer',
        category = 'own_transfers',
        classified_by = $1,
        classified_at = now()
    WHERE id = ANY($2)
  $q$, v_schema) USING auth.uid(), p_tx_ids;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count != v_expected THEN
    RAISE EXCEPTION 'Batch transfer partial: expected %, updated %', v_expected, v_count;
  END IF;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. revert_to_pending_batch — add RAISE on partial update
-- ============================================================
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
        classified_at = NULL
    WHERE id = ANY($1)
  $q$, v_schema) USING p_tx_ids;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count != v_expected THEN
    RAISE EXCEPTION 'Batch revert partial: expected %, updated %', v_expected, v_count;
  END IF;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. reclassify_transactions_batch — add RAISE on partial update
-- ============================================================
CREATE OR REPLACE FUNCTION public.reclassify_transactions_batch(
  p_household_id uuid,
  p_tx_ids uuid[],
  p_new_category text
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
    SET category = $1,
        classified_by = $2,
        status = 'manual',
        classified_at = now()
    WHERE id = ANY($3)
  $q$, v_schema) USING p_new_category, auth.uid(), p_tx_ids;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count != v_expected THEN
    RAISE EXCEPTION 'Batch reclassify partial: expected %, updated %', v_expected, v_count;
  END IF;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. get_classify_queue_counts — lightweight count check for truncation detection
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_classify_queue_counts(
  p_household_id uuid
) RETURNS TABLE(pending_count bigint, auto_count bigint) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT
      count(*) FILTER (WHERE status = 'pending') AS pending_count,
      count(*) FILTER (WHERE status = 'auto') AS auto_count
    FROM %I.transactions
  $q$, v_schema);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
