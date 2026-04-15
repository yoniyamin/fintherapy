-- Per-transaction user notes (classify swipe) + RPC. New households get column from create_household_schema.
-- Run in Supabase SQL Editor after migration_012.

-----------------------------------------------------------------------
-- 1. Add user_note to existing household transaction tables
-----------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schema_name FROM public.households LOOP
    EXECUTE format($q$
      ALTER TABLE %I.transactions
      ADD COLUMN IF NOT EXISTS user_note text
    $q$, r.schema_name);
  END LOOP;
END $$;

-----------------------------------------------------------------------
-- 2. New households: include user_note in transactions table
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
      user_note text,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 3. Set note on one or more transactions (same note for all ids)
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_transactions_user_note(
  p_household_id uuid,
  p_tx_ids uuid[],
  p_note text
) RETURNS void AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    UPDATE %I.transactions
    SET user_note = $1
    WHERE id = ANY($2::uuid[])
  $q$, v_schema) USING p_note, p_tx_ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 3b. Drop RPCs whose OUT columns change (CREATE OR REPLACE cannot alter return row type)
-----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_pending_transactions(uuid);
DROP FUNCTION IF EXISTS public.get_flagged_transactions(uuid);
DROP FUNCTION IF EXISTS public.get_auto_classified_transactions(uuid);
DROP FUNCTION IF EXISTS public.get_transactions_by_category(uuid, text, text, text[]);
DROP FUNCTION IF EXISTS public.get_classified_transactions_export(uuid, text);

-----------------------------------------------------------------------
-- 4. Pending / flagged / auto lists include user_note
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_pending_transactions(p_household_id uuid)
RETURNS TABLE(
  id uuid,
  uploaded_by uuid,
  merchant_raw text,
  merchant_clean text,
  amount numeric,
  tx_date date,
  billing_month text,
  account_last4 text,
  category text,
  status text,
  classified_by uuid,
  batch_id uuid,
  user_note text,
  created_at timestamptz
) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT id, uploaded_by, merchant_raw, merchant_clean,
           amount, tx_date, billing_month, account_last4,
           category, status, classified_by, batch_id, user_note, created_at
    FROM %I.transactions
    WHERE status = 'pending'
    ORDER BY tx_date DESC
  $q$, v_schema);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_flagged_transactions(p_household_id uuid)
RETURNS TABLE(
  id uuid,
  uploaded_by uuid,
  merchant_raw text,
  merchant_clean text,
  amount numeric,
  tx_date date,
  billing_month text,
  account_last4 text,
  category text,
  status text,
  classified_by uuid,
  batch_id uuid,
  user_note text,
  created_at timestamptz
) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT id, uploaded_by, merchant_raw, merchant_clean,
           amount, tx_date, billing_month, account_last4,
           category, status, classified_by, batch_id, user_note, created_at
    FROM %I.transactions
    WHERE status = 'flagged'
    ORDER BY tx_date DESC
  $q$, v_schema);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_auto_classified_transactions(p_household_id uuid)
RETURNS TABLE(
  id uuid,
  uploaded_by uuid,
  merchant_raw text,
  merchant_clean text,
  amount numeric,
  tx_date date,
  billing_month text,
  account_last4 text,
  category text,
  status text,
  classified_by uuid,
  batch_id uuid,
  user_note text,
  created_at timestamptz
) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT id, uploaded_by, merchant_raw, merchant_clean,
           amount, tx_date, billing_month, account_last4,
           category, status, classified_by, batch_id, user_note, created_at
    FROM %I.transactions
    WHERE status = 'auto'
    ORDER BY tx_date DESC
  $q$, v_schema);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 5. Category drill-down + export include user_note
-----------------------------------------------------------------------
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
        status IN ('manual', 'auto')
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

CREATE OR REPLACE FUNCTION public.get_classified_transactions_export(
  p_household_id uuid,
  p_billing_month text
) RETURNS TABLE(
  tx_date date,
  merchant_raw text,
  merchant_clean text,
  amount numeric,
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
    SELECT tx_date, merchant_raw, merchant_clean, amount,
           category, status, billing_month, account_last4, user_note
    FROM %I.transactions
    WHERE billing_month = $1
      AND status IN ('manual', 'auto')
    ORDER BY tx_date ASC
  $q$, v_schema) USING p_billing_month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.set_transactions_user_note(uuid, uuid[], text) TO authenticated;
