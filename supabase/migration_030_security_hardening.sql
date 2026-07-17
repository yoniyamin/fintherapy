------------------------------------------------------------------------
-- Migration 030 — Security Hardening
--
-- 1. Restrict profiles_update_own RLS to safe columns only
-- 2. Harden award_xp to require auth.uid() match
-- 3. Bind classified_by / uploaded_by to auth.uid() in RPCs
-- 4. Add status guard to classify_transaction
------------------------------------------------------------------------

------------------------------------------------------------------------
-- 1. Replace overly permissive profiles RLS policy.
--    Old policy allowed updating ANY column (household_id, total_xp).
--    New policy restricts direct updates to ui_prefs, display_name,
--    and avatar_url only.
------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_safe_columns" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND household_id IS NOT DISTINCT FROM (SELECT household_id FROM public.profiles WHERE id = auth.uid())
    AND total_xp IS NOT DISTINCT FROM (SELECT total_xp FROM public.profiles WHERE id = auth.uid())
  );

------------------------------------------------------------------------
-- 2. Harden award_xp — only the caller can award XP to themselves.
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id uuid,
  p_xp int
) RETURNS void AS $$
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Can only award XP to yourself';
  END IF;

  UPDATE public.profiles
  SET total_xp = total_xp + p_xp
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

------------------------------------------------------------------------
-- 3a. classify_transaction — bind classified_by to auth.uid(),
--     add status guard so already-classified rows can't be overwritten.
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.classify_transaction(
  p_household_id uuid,
  p_tx_id uuid,
  p_category text,
  p_classified_by uuid
) RETURNS void AS $$
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
    WHERE id = $3
      AND status IN ('pending', 'auto', 'flagged')
  $q$, v_schema) USING p_category, auth.uid(), p_tx_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Transaction not found or already classified';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

------------------------------------------------------------------------
-- 3b. confirm_auto_classified — bind classified_by to auth.uid().
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_auto_classified(
  p_household_id uuid,
  p_tx_id uuid,
  p_classified_by uuid
) RETURNS void AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    UPDATE %I.transactions
    SET status = 'manual',
        classified_by = $1,
        classified_at = now()
    WHERE id = $2 AND status = 'auto'
  $q$, v_schema) USING auth.uid(), p_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

------------------------------------------------------------------------
-- 3c. reclassify_transaction — bind classified_by to auth.uid().
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reclassify_transaction(
  p_household_id uuid,
  p_tx_id uuid,
  p_new_category text,
  p_classified_by uuid
) RETURNS void AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    UPDATE %I.transactions
    SET category = $1,
        classified_by = $2,
        status = 'manual',
        classified_at = now()
    WHERE id = $3
  $q$, v_schema) USING p_new_category, auth.uid(), p_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

------------------------------------------------------------------------
-- 3d. mark_as_transfer — bind classified_by to auth.uid().
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_as_transfer(
  p_household_id uuid,
  p_tx_id uuid,
  p_classified_by uuid
) RETURNS void AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    UPDATE %I.transactions
    SET status = 'transfer',
        category = 'own_transfers',
        classified_by = $1,
        classified_at = now()
    WHERE id = $2
  $q$, v_schema) USING auth.uid(), p_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

------------------------------------------------------------------------
-- 4. insert_transactions — bind uploaded_by to auth.uid().
------------------------------------------------------------------------
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
      $2,
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
  $q$, v_schema, v_schema) USING p_rows, auth.uid();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
