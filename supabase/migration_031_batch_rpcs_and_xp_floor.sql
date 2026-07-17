-- migration_031_batch_rpcs_and_xp_floor.sql
-- v1.4.0: Batch RPCs for classify flow + XP floor guard
-- Replaces per-tx loops with single multi-row operations.

-- ============================================================
-- 1. Batch classify
-- ============================================================
CREATE OR REPLACE FUNCTION public.classify_transactions_batch(
  p_household_id uuid,
  p_tx_ids uuid[],
  p_category text
) RETURNS int AS $$
DECLARE
  v_schema text;
  v_count int;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

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
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. Batch confirm auto-classified
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_auto_classified_batch(
  p_household_id uuid,
  p_tx_ids uuid[]
) RETURNS int AS $$
DECLARE
  v_schema text;
  v_count int;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    UPDATE %I.transactions
    SET status = 'manual',
        classified_by = $1,
        classified_at = now()
    WHERE id = ANY($2) AND status = 'auto'
  $q$, v_schema) USING auth.uid(), p_tx_ids;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. Batch flag
-- ============================================================
CREATE OR REPLACE FUNCTION public.flag_transactions_batch(
  p_household_id uuid,
  p_tx_ids uuid[]
) RETURNS int AS $$
DECLARE
  v_schema text;
  v_count int;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    UPDATE %I.transactions
    SET status = 'flagged'
    WHERE id = ANY($1)
      AND status IN ('pending', 'auto')
  $q$, v_schema) USING p_tx_ids;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. Batch mark as transfer
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_as_transfer_batch(
  p_household_id uuid,
  p_tx_ids uuid[]
) RETURNS int AS $$
DECLARE
  v_schema text;
  v_count int;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    UPDATE %I.transactions
    SET status = 'transfer',
        category = 'own_transfers',
        classified_by = $1,
        classified_at = now()
    WHERE id = ANY($2)
  $q$, v_schema) USING auth.uid(), p_tx_ids;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. Batch revert to pending
-- ============================================================
CREATE OR REPLACE FUNCTION public.revert_to_pending_batch(
  p_household_id uuid,
  p_tx_ids uuid[]
) RETURNS int AS $$
DECLARE
  v_schema text;
  v_count int;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    UPDATE %I.transactions
    SET status = 'pending',
        category = NULL,
        classified_by = NULL,
        classified_at = NULL
    WHERE id = ANY($1)
  $q$, v_schema) USING p_tx_ids;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. Batch reclassify
-- ============================================================
CREATE OR REPLACE FUNCTION public.reclassify_transactions_batch(
  p_household_id uuid,
  p_tx_ids uuid[],
  p_new_category text
) RETURNS int AS $$
DECLARE
  v_schema text;
  v_count int;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    UPDATE %I.transactions
    SET category = $1,
        classified_by = $2,
        status = 'manual',
        classified_at = now()
    WHERE id = ANY($3)
  $q$, v_schema) USING p_new_category, auth.uid(), p_tx_ids;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. award_xp — floor at 0 to support negative (clawback)
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id uuid,
  p_xp int
) RETURNS void AS $$
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Can only award XP to yourself';
  END IF;

  UPDATE public.profiles
  SET total_xp = GREATEST(0, total_xp + p_xp)
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
