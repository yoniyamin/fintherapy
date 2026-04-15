-- No idea deck, own_transfers category, account aliases, filtered reveal summary
-- Apply in Supabase SQL Editor after prior migrations.

-----------------------------------------------------------------------
-- 1. Flagged transactions list (No idea deck)
-----------------------------------------------------------------------
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
  created_at timestamptz
) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT id, uploaded_by, merchant_raw, merchant_clean,
           amount, tx_date, billing_month, account_last4,
           category, status, classified_by, batch_id, created_at
    FROM %I.transactions
    WHERE status = 'flagged'
    ORDER BY tx_date DESC
  $q$, v_schema);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_flagged_transactions_count(p_household_id uuid)
RETURNS bigint AS $$
DECLARE
  v_schema text;
  v_count bigint;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    SELECT COUNT(*)::bigint FROM %I.transactions WHERE status = 'flagged'
  $q$, v_schema) INTO v_count;

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 2. Money transfers → own_transfers category
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
    SET status = 'transfer',
        category = 'own_transfers',
        classified_by = $1
    WHERE id = $2
  $q$, v_schema) USING p_classified_by, p_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing transfer rows
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schema_name FROM public.households LOOP
    EXECUTE format(
      $q$UPDATE %I.transactions SET category = 'own_transfers'
        WHERE status = 'transfer' AND (category IS NULL OR category = '')$q$,
      r.schema_name
    );
  END LOOP;
END $$;

-----------------------------------------------------------------------
-- 3. Monthly summary with optional account filter + own_transfers in totals
-----------------------------------------------------------------------
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
           SUM(t.amount)::numeric AS total_amount,
           COUNT(*)::bigint AS tx_count
    FROM %I.transactions t
    WHERE t.billing_month = $1
      AND t.category IS NOT NULL
      AND (
        (t.status IN ('manual', 'auto'))
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

-----------------------------------------------------------------------
-- 4. Transactions by category (own transfers + account filter)
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
  account_last4 text
) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT id, merchant_raw, merchant_clean, amount, tx_date,
           category, status, classified_by, account_last4
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

-----------------------------------------------------------------------
-- 5. Distinct account last4 for a month (for filters + alias UI)
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_distinct_account_last4_for_month(
  p_household_id uuid,
  p_billing_month text
) RETURNS TABLE(account_last4 text) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT DISTINCT t.account_last4::text
    FROM %I.transactions t
    WHERE t.billing_month = $1
      AND t.account_last4 IS NOT NULL
      AND trim(t.account_last4) <> ''
    ORDER BY 1
  $q$, v_schema) USING p_billing_month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 6. Account aliases (per household schema)
-----------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schema_name FROM public.households LOOP
    EXECUTE format($q$
      CREATE TABLE IF NOT EXISTS %I.account_aliases (
        last4 text PRIMARY KEY CHECK (char_length(trim(last4)) > 0),
        label text NOT NULL,
        updated_at timestamptz DEFAULT now()
      )
    $q$, r.schema_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_account_aliases(p_household_id uuid)
RETURNS TABLE(last4 text, label text) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT a.last4, a.label FROM %I.account_aliases a ORDER BY a.last4
  $q$, v_schema);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.upsert_account_alias(
  p_household_id uuid,
  p_last4 text,
  p_label text
) RETURNS void AS $$
DECLARE
  v_schema text;
  v_last4 text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);
  v_last4 := trim(p_last4);
  IF v_last4 = '' THEN
    RAISE EXCEPTION 'last4 required';
  END IF;

  EXECUTE format($q$
    INSERT INTO %I.account_aliases (last4, label, updated_at)
    VALUES ($1, trim($2), now())
    ON CONFLICT (last4) DO UPDATE SET label = EXCLUDED.label, updated_at = now()
  $q$, v_schema) USING v_last4, p_label;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.delete_account_alias(
  p_household_id uuid,
  p_last4 text
) RETURNS void AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    DELETE FROM %I.account_aliases WHERE last4 = $1
  $q$, v_schema) USING trim(p_last4);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 7. create_household_schema: include account_aliases for NEW households
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
    CREATE TABLE %I.account_aliases (
      last4 text PRIMARY KEY CHECK (char_length(trim(last4)) > 0),
      label text NOT NULL,
      updated_at timestamptz DEFAULT now()
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
