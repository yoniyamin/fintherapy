-- Financial Therapy: Dedup uploads + cleanup
-- Run in Supabase SQL Editor.

-----------------------------------------------------------------------
-- 1. Replace insert_transactions with dedup-aware version
--    Skips rows where (merchant_raw, amount, tx_date, billing_month)
--    already exists in the schema's transactions table.
-----------------------------------------------------------------------
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
    )
  $q$, v_schema, v_schema) USING p_rows;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- 2. One-time cleanup: remove duplicate transactions
--    Keeps the oldest row per (merchant_raw, amount, tx_date, billing_month),
--    deletes the rest.
-----------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_deleted int;
BEGIN
  FOR r IN SELECT schema_name FROM public.households LOOP
    EXECUTE format($q$
      DELETE FROM %I.transactions
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY merchant_raw, amount, tx_date, billing_month
              ORDER BY created_at ASC
            ) AS rn
          FROM %I.transactions
        ) ranked
        WHERE rn > 1
      )
    $q$, r.schema_name, r.schema_name);

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    IF v_deleted > 0 THEN
      RAISE NOTICE 'Deleted % duplicate(s) from schema %', v_deleted, r.schema_name;
    END IF;
  END LOOP;
END $$;

-----------------------------------------------------------------------
-- 3. Recalculate XP after dedup (reset to accurate count)
-----------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  UPDATE public.profiles SET total_xp = 0;

  FOR r IN SELECT schema_name FROM public.households LOOP
    EXECUTE format($q$
      UPDATE public.profiles p
      SET total_xp = p.total_xp + COALESCE(sub.earned_xp, 0)
      FROM (
        SELECT classified_by, COUNT(*) * 10 as earned_xp
        FROM %I.transactions
        WHERE status IN ('manual', 'auto')
          AND classified_by IS NOT NULL
        GROUP BY classified_by
      ) sub
      WHERE p.id = sub.classified_by
    $q$, r.schema_name);
  END LOOP;
END $$;
