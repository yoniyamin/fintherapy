-- When a transaction was classified (not when it was uploaded).
-- Fixes Home "Today" + leaderboard daily counts using created_at by mistake.
-- Apply after migration_018.

-----------------------------------------------------------------------
-- 1. Add classified_at to existing household transaction tables
-----------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schema_name FROM public.households LOOP
    EXECUTE format($q$
      ALTER TABLE %I.transactions
      ADD COLUMN IF NOT EXISTS classified_at timestamptz
    $q$, r.schema_name);
  END LOOP;
END $$;

-----------------------------------------------------------------------
-- 2. Backfill: approximate legacy rows (true classify time unknown)
-----------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schema_name FROM public.households LOOP
    EXECUTE format($q$
      UPDATE %I.transactions
      SET classified_at = created_at
      WHERE classified_by IS NOT NULL
        AND status IN ('manual', 'auto', 'transfer')
        AND classified_at IS NULL
    $q$, r.schema_name);
  END LOOP;
END $$;

-----------------------------------------------------------------------
-- 3. New households: transactions include classified_at
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
      created_at  timestamptz DEFAULT now(),
      updated_at  timestamptz DEFAULT now()
    )
  $t$, new.schema_name);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 4. Set classified_at when users classify / transfer / reclassify
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.classify_transaction(
  p_household_id uuid,
  p_tx_id uuid,
  p_category text,
  p_classified_by uuid
) RETURNS void AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    UPDATE %I.transactions
    SET category = $1,
        status = 'manual',
        classified_by = $2,
        classified_at = now()
    WHERE id = $3
  $q$, v_schema) USING p_category, p_classified_by, p_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  $q$, v_schema) USING p_classified_by, p_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  $q$, v_schema) USING p_new_category, p_classified_by, p_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  $q$, v_schema) USING p_classified_by, p_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.reject_auto_classified(
  p_household_id uuid,
  p_tx_id uuid
) RETURNS void AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    UPDATE %I.transactions
    SET status = 'pending',
        category = NULL,
        classified_at = NULL
    WHERE id = $1 AND status = 'auto'
  $q$, v_schema) USING p_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 5. Daily metrics: count by classified_at (actual classify day)
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_daily_activity_summary(
  p_household_id uuid,
  p_date date DEFAULT CURRENT_DATE
) RETURNS TABLE(
  user_id uuid,
  display_name text,
  classified_today bigint,
  uploads_today bigint,
  bets_placed_today bigint
) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT
      p.id AS user_id,
      p.display_name,
      COALESCE(c.cnt, 0)::bigint AS classified_today,
      COALESCE(u.cnt, 0)::bigint AS uploads_today,
      COALESCE(b.cnt, 0)::bigint AS bets_placed_today
    FROM public.profiles p
    LEFT JOIN (
      SELECT classified_by, COUNT(*) AS cnt
      FROM %I.transactions
      WHERE status IN ('manual', 'auto', 'transfer')
        AND classified_by IS NOT NULL
        AND classified_at IS NOT NULL
        AND classified_at::date = $1
      GROUP BY classified_by
    ) c ON c.classified_by = p.id
    LEFT JOIN (
      SELECT uploaded_by, COUNT(*) AS cnt
      FROM %I.transactions
      WHERE created_at::date = $1
        AND uploaded_by IS NOT NULL
      GROUP BY uploaded_by
    ) u ON u.uploaded_by = p.id
    LEFT JOIN (
      SELECT g.user_id, COUNT(DISTINCT g.month) AS cnt
      FROM %I.guesses g
      WHERE g.created_at::date = $1
      GROUP BY g.user_id
    ) b ON b.user_id = p.id
    WHERE p.household_id = $2
      AND (COALESCE(c.cnt, 0) > 0 OR COALESCE(u.cnt, 0) > 0 OR COALESCE(b.cnt, 0) > 0)
    ORDER BY COALESCE(c.cnt, 0) DESC, COALESCE(u.cnt, 0) DESC
  $q$, v_schema, v_schema, v_schema) USING p_date, p_household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_daily_classification_counts(
  p_household_id uuid,
  p_date date DEFAULT CURRENT_DATE
) RETURNS TABLE(
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
      p.id AS user_id,
      p.display_name,
      COUNT(t.id) AS classified_today
    FROM public.profiles p
    LEFT JOIN %I.transactions t
      ON t.classified_by = p.id
      AND t.status IN ('manual', 'auto', 'transfer')
      AND t.classified_at IS NOT NULL
      AND t.classified_at::date = $1
    WHERE p.household_id = $2
    GROUP BY p.id, p.display_name
    ORDER BY classified_today DESC
  $q$, v_schema) USING p_date, p_household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
