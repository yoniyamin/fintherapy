-- Include flagged ("No idea") transactions in reports and analysis.
-- Adds smart re-suggestion RPC for resolving flagged items over time.
-- Run after migration_037.

-------------------------------------------------------------------------
-- 1. Backfill: set category = 'no_idea' on existing flagged rows
-------------------------------------------------------------------------
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT schema_name FROM public.households LOOP
    EXECUTE format($q$
      UPDATE %I.transactions
      SET category = 'no_idea'
      WHERE status = 'flagged'
        AND (category IS NULL OR category = '')
    $q$, r.schema_name);
  END LOOP;
END $$;

-------------------------------------------------------------------------
-- 2a. flag_transaction — also set category = 'no_idea'
-------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.flag_transaction(
  p_household_id uuid,
  p_tx_id uuid
) RETURNS void AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    UPDATE %I.transactions
    SET status = 'flagged',
        category = 'no_idea'
    WHERE id = $1
  $q$, v_schema) USING p_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-------------------------------------------------------------------------
-- 2b. flag_transactions_batch — also set category = 'no_idea'
-------------------------------------------------------------------------
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
    SET status = 'flagged',
        category = 'no_idea'
    WHERE id = ANY($1)
      AND status IN ('pending', 'auto')
  $q$, v_schema) USING p_tx_ids;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-------------------------------------------------------------------------
-- 3. get_monthly_summary — include status = 'flagged'
-------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_monthly_summary(
  p_household_id uuid,
  p_billing_month text,
  p_account_last4s text[] DEFAULT NULL
) RETURNS TABLE(
  category text,
  total_amount numeric,
  tx_count bigint
) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT t.category,
           SUM(public._normalized_spend(t.amount, a.account_type))::numeric AS total_amount,
           COUNT(*)::bigint AS tx_count
    FROM %1$I.transactions t
    LEFT JOIN %1$I.account_aliases a ON a.last4 = t.account_last4
    WHERE t.billing_month = $1
      AND t.category IS NOT NULL
      AND (
        t.status IN ('manual', 'auto', 'flagged')
        OR (t.status = 'transfer' AND t.category = 'own_transfers')
      )
      AND (
        $2 IS NULL
        OR cardinality($2) = 0
        OR t.account_last4 = ANY($2)
      )
    GROUP BY t.category
    ORDER BY total_amount DESC
  $q$, v_schema) USING p_billing_month, p_account_last4s;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-------------------------------------------------------------------------
-- 4. get_monthly_totals — include status = 'flagged'
-------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_monthly_totals(
  p_household_id uuid,
  p_include_own_transfers boolean DEFAULT false
) RETURNS TABLE(
  billing_month text,
  total_amount numeric,
  tx_count bigint
) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT t.billing_month,
           SUM(public._normalized_spend(t.amount, a.account_type))::numeric AS total_amount,
           COUNT(*)::bigint AS tx_count
    FROM %1$I.transactions t
    LEFT JOIN %1$I.account_aliases a ON a.last4 = t.account_last4
    WHERE t.status IN ('manual', 'auto', 'flagged')
      AND t.category IS NOT NULL
      AND ($1 OR t.category IS DISTINCT FROM 'own_transfers')
    GROUP BY t.billing_month
    ORDER BY t.billing_month ASC
  $q$, v_schema) USING p_include_own_transfers;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-------------------------------------------------------------------------
-- 5. get_classified_transactions_export — include status = 'flagged'
-------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_classified_transactions_export(
  p_household_id uuid,
  p_billing_month text
) RETURNS TABLE(
  tx_date date,
  merchant_raw text,
  merchant_clean text,
  amount numeric,
  normalized_amount numeric,
  category text,
  status text,
  billing_month text,
  account_last4 text,
  user_note text
) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT t.tx_date, t.merchant_raw, t.merchant_clean, t.amount,
           public._normalized_spend(t.amount, a.account_type) AS normalized_amount,
           t.category, t.status, t.billing_month, t.account_last4, t.user_note
    FROM %1$I.transactions t
    LEFT JOIN %1$I.account_aliases a ON a.last4 = t.account_last4
    WHERE t.billing_month = $1
      AND t.status IN ('manual', 'auto', 'flagged')
    ORDER BY t.tx_date ASC
  $q$, v_schema) USING p_billing_month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-------------------------------------------------------------------------
-- 6. get_transactions_by_category — include status = 'flagged'
-------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_transactions_by_category(
  p_household_id uuid,
  p_billing_month text,
  p_category text,
  p_account_last4s text[] DEFAULT NULL
) RETURNS TABLE(
  id uuid,
  merchant_raw text,
  merchant_clean text,
  amount numeric,
  tx_date date,
  category text,
  status text,
  classified_by uuid,
  account_last4 text,
  user_note text
) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT id, merchant_raw, merchant_clean, amount, tx_date,
           category, status, classified_by, account_last4, user_note
    FROM %I.transactions
    WHERE billing_month = $1
      AND category = $2
      AND (
        status IN ('manual', 'auto', 'flagged')
        OR (status = 'transfer' AND category = 'own_transfers')
      )
      AND (
        $3 IS NULL
        OR cardinality($3) = 0
        OR account_last4 = ANY($3)
      )
    ORDER BY tx_date DESC
  $q$, v_schema) USING p_billing_month, p_category, p_account_last4s;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-------------------------------------------------------------------------
-- 7. get_spending_by_account — include status = 'flagged'
-------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_spending_by_account(
  p_household_id uuid,
  p_billing_months text[]
) RETURNS TABLE(
  billing_month text,
  account_last4 text,
  label text,
  account_type text,
  total_amount numeric,
  tx_count bigint
) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT t.billing_month,
           t.account_last4,
           COALESCE(a.label, t.account_last4) AS label,
           a.account_type,
           SUM(public._normalized_spend(t.amount, a.account_type))::numeric AS total_amount,
           COUNT(*)::bigint AS tx_count
    FROM %1$I.transactions t
    LEFT JOIN %1$I.account_aliases a ON a.last4 = t.account_last4
    WHERE t.billing_month = ANY($1)
      AND t.status IN ('manual', 'auto', 'flagged')
      AND t.category IS NOT NULL
      AND t.category IS DISTINCT FROM 'own_transfers'
    GROUP BY t.billing_month, t.account_last4, a.label, a.account_type
    ORDER BY t.billing_month ASC, total_amount DESC
  $q$, v_schema) USING p_billing_months;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-------------------------------------------------------------------------
-- 8. suggest_flagged_resolutions — smart re-suggestion via merchant_knowledge
-------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.suggest_flagged_resolutions(
  p_household_id uuid
) RETURNS TABLE(
  tx_id uuid,
  merchant_raw text,
  amount numeric,
  tx_date date,
  suggested_category text,
  confidence numeric
) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT t.id, t.merchant_raw, t.amount, t.tx_date,
           mk.category, mk.confidence
    FROM %I.transactions t
    JOIN %I.merchant_knowledge mk
      ON lower(trim(t.merchant_raw)) = mk.merchant_pattern
    WHERE t.status = 'flagged'
      AND mk.confidence >= 0.5
    ORDER BY t.tx_date DESC
  $q$, v_schema, v_schema);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-------------------------------------------------------------------------
-- 9. Grants
-------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.suggest_flagged_resolutions(uuid) TO authenticated;
