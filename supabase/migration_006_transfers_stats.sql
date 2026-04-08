-- Financial Therapy: Transfers, Refund Pairing, XP, Stats, Drill-down, Export
-- Run AFTER migration_005_reveal_v2.sql in Supabase SQL Editor.

-----------------------------------------------------------------------
-- 1. Expand status constraint for existing schemas
--    Adds 'transfer' and 'offset' as valid status values
-----------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_constraint_name text;
BEGIN
  FOR r IN SELECT schema_name FROM public.households LOOP
    SELECT conname INTO v_constraint_name
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = r.schema_name
      AND c.conrelid = (
        SELECT oid FROM pg_class
        WHERE relname = 'transactions' AND relnamespace = n.oid
      )
      AND c.contype = 'c'
    LIMIT 1;

    IF v_constraint_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I.transactions DROP CONSTRAINT %I',
        r.schema_name, v_constraint_name);
    END IF;

    EXECUTE format($q$
      ALTER TABLE %I.transactions
      ADD CONSTRAINT transactions_status_check
      CHECK (status IN ('auto','manual','pending','flagged','transfer','offset'))
    $q$, r.schema_name);
  END LOOP;
END $$;

-----------------------------------------------------------------------
-- 2. Update create_household_schema for NEW schemas
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_household_schema()
RETURNS trigger AS $$
BEGIN
  EXECUTE format('CREATE SCHEMA %I', new.schema_name);

  EXECUTE format($t$
    CREATE TABLE %I.transactions (
      id uuid primary key default gen_random_uuid(),
      uploaded_by uuid references public.profiles(id),
      merchant_raw text not null,
      merchant_clean text,
      amount numeric(10,2) not null,
      tx_date date not null,
      billing_month text not null,
      account_last4 text,
      category text,
      status text default 'pending'
        check (status in ('auto','manual','pending','flagged','transfer','offset')),
      classified_by uuid references public.profiles(id),
      batch_id uuid,
      created_at timestamptz default now()
    )
  $t$, new.schema_name);

  EXECUTE format($t$
    CREATE TABLE %I.merchant_knowledge (
      id uuid primary key default gen_random_uuid(),
      merchant_pattern text not null unique,
      category text not null,
      confidence numeric(3,2) default 1.0,
      created_at timestamptz default now()
    )
  $t$, new.schema_name);

  EXECUTE format($t$
    CREATE TABLE %I.guesses (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references public.profiles(id) not null,
      month date not null,
      category text not null,
      predicted_amount numeric(10,2) not null,
      created_at timestamptz default now()
    )
  $t$, new.schema_name);

  RETURN new;
END;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- 3. Mark a transaction as money transfer
-----------------------------------------------------------------------
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
    SET status = 'transfer', classified_by = $1
    WHERE id = $2
  $q$, v_schema) USING p_classified_by, p_tx_id;
END;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- 4. Detect and offset refund pairs among pending transactions
--    Matches same merchant_raw with amounts that are exact negatives.
--    Returns number of pairs offset.
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.detect_and_offset_refunds(
  p_household_id uuid
) RETURNS int AS $$
DECLARE
  v_schema text;
  v_count int;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    WITH pairs AS (
      SELECT DISTINCT ON (a.id) a.id as purchase_id, b.id as refund_id
      FROM %1$I.transactions a
      JOIN %1$I.transactions b
        ON lower(trim(a.merchant_raw)) = lower(trim(b.merchant_raw))
        AND a.amount = -b.amount
        AND a.id < b.id
        AND a.status = 'pending'
        AND b.status = 'pending'
    )
    UPDATE %1$I.transactions t
    SET status = 'offset'
    FROM (
      SELECT purchase_id AS id FROM pairs
      UNION ALL
      SELECT refund_id AS id FROM pairs
    ) matched
    WHERE t.id = matched.id
  $q$, v_schema);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count / 2;
END;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- 5. Award XP to a user profile
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id uuid,
  p_xp int
) RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET total_xp = total_xp + p_xp
  WHERE id = p_user_id;
END;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- 6. Get month classification stats (total / classified / pending)
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_month_classification_stats(
  p_household_id uuid,
  p_billing_month text
) RETURNS table(
  total_count bigint,
  classified_count bigint,
  pending_count bigint,
  transfer_count bigint,
  offset_count bigint,
  flagged_count bigint
) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE status IN ('manual', 'auto')) as classified_count,
      COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
      COUNT(*) FILTER (WHERE status = 'transfer') as transfer_count,
      COUNT(*) FILTER (WHERE status = 'offset') as offset_count,
      COUNT(*) FILTER (WHERE status = 'flagged') as flagged_count
    FROM %I.transactions
    WHERE billing_month = $1
  $q$, v_schema) USING p_billing_month;
END;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- 7. Get transactions by category (for drill-down in reveal)
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_transactions_by_category(
  p_household_id uuid,
  p_billing_month text,
  p_category text
) RETURNS table(
  id uuid,
  merchant_raw text,
  merchant_clean text,
  amount numeric,
  tx_date date,
  category text,
  status text,
  classified_by uuid
) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT id, merchant_raw, merchant_clean, amount, tx_date,
           category, status, classified_by
    FROM %I.transactions
    WHERE billing_month = $1
      AND category = $2
      AND status IN ('manual', 'auto')
    ORDER BY tx_date DESC
  $q$, v_schema) USING p_billing_month, p_category;
END;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- 8. Reclassify a transaction (move to different category)
-----------------------------------------------------------------------
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
    SET category = $1, classified_by = $2, status = 'manual'
    WHERE id = $3
  $q$, v_schema) USING p_new_category, p_classified_by, p_tx_id;
END;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- 9. Get classified transactions for CSV export
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_classified_transactions_export(
  p_household_id uuid,
  p_billing_month text
) RETURNS table(
  tx_date date,
  merchant_raw text,
  merchant_clean text,
  amount numeric,
  category text,
  status text,
  billing_month text,
  account_last4 text
) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT tx_date, merchant_raw, merchant_clean, amount,
           category, status, billing_month, account_last4
    FROM %I.transactions
    WHERE billing_month = $1
      AND status IN ('manual', 'auto')
    ORDER BY tx_date ASC
  $q$, v_schema) USING p_billing_month;
END;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- 10. Get daily classification counts for leaderboard
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_daily_classification_counts(
  p_household_id uuid,
  p_date date DEFAULT CURRENT_DATE
) RETURNS table(
  user_id uuid,
  display_name text,
  classified_today bigint
) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT
      p.id as user_id,
      p.display_name,
      COUNT(t.id) as classified_today
    FROM public.profiles p
    LEFT JOIN %I.transactions t
      ON t.classified_by = p.id
      AND t.status IN ('manual', 'auto', 'transfer')
      AND t.created_at::date = $1
    WHERE p.household_id = $2
    GROUP BY p.id, p.display_name
    ORDER BY classified_today DESC
  $q$, v_schema) USING p_date, p_household_id;
END;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- 11. Get household info (name + invite code)
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_household_info(
  p_household_id uuid
) RETURNS table(
  id uuid,
  name text,
  invite_code text
) AS $$
BEGIN
  RETURN QUERY
  SELECT h.id, h.name, h.invite_code
  FROM public.households h
  WHERE h.id = p_household_id;
END;
$$ language plpgsql security definer;
