-- Monthly trend RPC: optionally include own_transfers (default: exclude, aligned with Reveal pie).
-- Run after migration_013. Replaces single-arg get_monthly_totals(uuid).

DROP FUNCTION IF EXISTS public.get_monthly_totals(uuid);

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
    SELECT billing_month, SUM(amount)::numeric AS total_amount, COUNT(*)::bigint AS tx_count
    FROM %I.transactions
    WHERE status IN ('manual', 'auto')
      AND category IS NOT NULL
      AND ($1 OR category IS DISTINCT FROM 'own_transfers')
    GROUP BY billing_month
    ORDER BY billing_month ASC
  $q$, v_schema) USING p_include_own_transfers;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
