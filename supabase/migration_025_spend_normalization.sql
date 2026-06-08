-- Spend normalization: query-time sign fix for mixed credit/debit card amounts.
-- Also adds transfer_kind for card funding / salary detection.
-- Run after migration_024.

-----------------------------------------------------------------------
-- 1. Normalized spend helper (IMMUTABLE — Postgres can inline/cache)
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._normalized_spend(
  p_amount numeric,
  p_account_type text
) RETURNS numeric AS $$
BEGIN
  IF p_account_type = 'credit' THEN
    RETURN -p_amount;
  ELSIF p_account_type = 'debit' THEN
    RETURN p_amount;
  ELSE
    RETURN ABS(p_amount);
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-----------------------------------------------------------------------
-- 2. Add transfer_kind to existing household transaction tables
-----------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schema_name FROM public.households LOOP
    EXECUTE format($q$
      ALTER TABLE %I.transactions
      ADD COLUMN IF NOT EXISTS transfer_kind text
      CHECK (transfer_kind IS NULL OR transfer_kind IN ('card_funding','salary_in','internal'))
    $q$, r.schema_name);
  END LOOP;
END $$;

-----------------------------------------------------------------------
-- 3. Updated get_monthly_totals: uses _normalized_spend + account JOIN
-----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_monthly_totals(uuid, boolean);

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
    WHERE t.status IN ('manual', 'auto')
      AND t.category IS NOT NULL
      AND ($1 OR t.category IS DISTINCT FROM 'own_transfers')
    GROUP BY t.billing_month
    ORDER BY t.billing_month ASC
  $q$, v_schema) USING p_include_own_transfers;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 4. Updated get_monthly_summary: uses _normalized_spend + account JOIN
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
           SUM(public._normalized_spend(t.amount, a.account_type))::numeric AS total_amount,
           COUNT(*)::bigint AS tx_count
    FROM %1$I.transactions t
    LEFT JOIN %1$I.account_aliases a ON a.last4 = t.account_last4
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
-- 5. Updated export RPC: adds normalized_amount column
-----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_classified_transactions_export(uuid, text);

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
      AND t.status IN ('manual', 'auto')
    ORDER BY t.tx_date ASC
  $q$, v_schema) USING p_billing_month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 6. New RPC: spending breakdown by account (for per-member panels)
-----------------------------------------------------------------------
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
      AND t.status IN ('manual', 'auto')
      AND t.category IS NOT NULL
      AND t.category IS DISTINCT FROM 'own_transfers'
    GROUP BY t.billing_month, t.account_last4, a.label, a.account_type
    ORDER BY t.billing_month ASC, total_amount DESC
  $q$, v_schema) USING p_billing_months;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 7. New RPC: card funding summary (transfers to shared cards)
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_card_funding_summary(
  p_household_id uuid,
  p_billing_months text[]
) RETURNS TABLE(
  billing_month text,
  source_account text,
  source_label text,
  transfer_kind text,
  total_amount numeric,
  tx_count bigint
) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT t.billing_month,
           t.account_last4 AS source_account,
           COALESCE(a.label, t.account_last4) AS source_label,
           COALESCE(t.transfer_kind, 'internal') AS transfer_kind,
           SUM(ABS(t.amount))::numeric AS total_amount,
           COUNT(*)::bigint AS tx_count
    FROM %1$I.transactions t
    LEFT JOIN %1$I.account_aliases a ON a.last4 = t.account_last4
    WHERE t.billing_month = ANY($1)
      AND (t.status = 'transfer' OR t.category = 'own_transfers')
      AND COALESCE(t.transfer_kind, 'internal') IN ('card_funding', 'internal')
    GROUP BY t.billing_month, t.account_last4, a.label, t.transfer_kind
    ORDER BY t.billing_month ASC, total_amount DESC
  $q$, v_schema) USING p_billing_months;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 8. New RPC: salary detection summary
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_salary_in_summary(
  p_household_id uuid,
  p_billing_months text[]
) RETURNS TABLE(
  billing_month text,
  account_last4 text,
  label text,
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
           SUM(ABS(t.amount))::numeric AS total_amount,
           COUNT(*)::bigint AS tx_count
    FROM %1$I.transactions t
    LEFT JOIN %1$I.account_aliases a ON a.last4 = t.account_last4
    WHERE t.billing_month = ANY($1)
      AND t.transfer_kind = 'salary_in'
    GROUP BY t.billing_month, t.account_last4, a.label
    ORDER BY t.billing_month ASC, total_amount DESC
  $q$, v_schema) USING p_billing_months;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 9. New RPC: set transfer_kind on a transaction
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_transfer_kind(
  p_household_id uuid,
  p_tx_id uuid,
  p_transfer_kind text
) RETURNS void AS $$
DECLARE
  v_schema text;
  v_kind text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);
  v_kind := nullif(trim(coalesce(p_transfer_kind, '')), '');

  IF v_kind IS NOT NULL AND v_kind NOT IN ('card_funding', 'salary_in', 'internal') THEN
    RAISE EXCEPTION 'transfer_kind must be card_funding, salary_in, or internal';
  END IF;

  EXECUTE format($q$
    UPDATE %I.transactions
    SET transfer_kind = $1
    WHERE id = $2
  $q$, v_schema) USING v_kind, p_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 10. Backfill transfer_kind from merchant patterns
-----------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schema_name FROM public.households LOOP
    EXECUTE format($q$
      UPDATE %I.transactions
      SET transfer_kind = 'salary_in'
      WHERE (status = 'transfer' OR category = 'own_transfers')
        AND transfer_kind IS NULL
        AND merchant_raw ILIKE '%%NOMINA%%'
    $q$, r.schema_name);

    EXECUTE format($q$
      UPDATE %I.transactions
      SET transfer_kind = 'card_funding'
      WHERE (status = 'transfer' OR category = 'own_transfers')
        AND transfer_kind IS NULL
        AND (
          merchant_raw ILIKE '%%TRASPAS%%'
          OR merchant_raw ILIKE '%%TRASPÀS%%'
          OR merchant_raw ILIKE '%%OWN TRANSFER%%'
          OR merchant_raw ILIKE '%%TRANSFERENCIA%%'
        )
    $q$, r.schema_name);

    EXECUTE format($q$
      UPDATE %I.transactions
      SET transfer_kind = 'card_funding'
      WHERE (status = 'transfer' OR category = 'own_transfers')
        AND transfer_kind IS NULL
        AND amount > 0
        AND account_last4 IN (
          SELECT last4 FROM %I.account_aliases WHERE account_type = 'debit'
        )
    $q$, r.schema_name, r.schema_name);

    EXECUTE format($q$
      UPDATE %I.transactions
      SET transfer_kind = 'internal'
      WHERE (status = 'transfer' OR category = 'own_transfers')
        AND transfer_kind IS NULL
    $q$, r.schema_name);
  END LOOP;
END $$;

-----------------------------------------------------------------------
-- 11. Update create_household_schema: include transfer_kind
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
      classified_at timestamptz,
      batch_id uuid,
      user_note text,
      transfer_kind text
        check (transfer_kind is null or transfer_kind in ('card_funding','salary_in','internal')),
      created_at timestamptz default now()
    )
  $t$, new.schema_name);

  EXECUTE format($t$
    CREATE TABLE %I.account_aliases (
      last4 text PRIMARY KEY CHECK (char_length(trim(last4)) > 0),
      label text NOT NULL,
      account_type text CHECK (account_type IS NULL OR account_type IN ('credit','debit')),
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

  EXECUTE format($t$
    CREATE TABLE %I.category_overrides (
      id          text PRIMARY KEY CHECK (char_length(trim(id)) > 0),
      label       text NOT NULL CHECK (char_length(trim(label)) > 0),
      icon        text NOT NULL DEFAULT '📦',
      color       text NOT NULL DEFAULT 'bg-slate-500/20 border-slate-500/40',
      previous_ids text[] NOT NULL DEFAULT '{}',
      sort_order  int NOT NULL DEFAULT 999,
      expense_type text NOT NULL DEFAULT 'discretionary'
        CHECK (expense_type IN ('fixed', 'discretionary')),
      created_at  timestamptz DEFAULT now(),
      updated_at  timestamptz DEFAULT now()
    )
  $t$, new.schema_name);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 12. Add expense_type to existing category_overrides tables
-----------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schema_name FROM public.households LOOP
    EXECUTE format($q$
      ALTER TABLE %I.category_overrides
      ADD COLUMN IF NOT EXISTS expense_type text NOT NULL DEFAULT 'discretionary'
      CHECK (expense_type IN ('fixed', 'discretionary'))
    $q$, r.schema_name);
  END LOOP;
END $$;

-----------------------------------------------------------------------
-- 13. Grants
-----------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public._normalized_spend(numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_spending_by_account(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_card_funding_summary(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_salary_in_summary(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_transfer_kind(uuid, uuid, text) TO authenticated;
