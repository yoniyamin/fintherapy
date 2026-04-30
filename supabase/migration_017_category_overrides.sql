-- Category customisation: rename, re-icon, re-colour categories per household.
-- Tracks previous IDs so merchant_knowledge auto-classify still works after renames.
-- Apply in Supabase SQL Editor after migration_016.

-----------------------------------------------------------------------
-- 1. category_overrides table (per household schema)
-----------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schema_name FROM public.households LOOP
    EXECUTE format($q$
      CREATE TABLE IF NOT EXISTS %I.category_overrides (
        id          text PRIMARY KEY CHECK (char_length(trim(id)) > 0),
        label       text NOT NULL CHECK (char_length(trim(label)) > 0),
        icon        text NOT NULL DEFAULT '📦',
        color       text NOT NULL DEFAULT 'bg-slate-500/20 border-slate-500/40',
        previous_ids text[] NOT NULL DEFAULT '{}',
        sort_order  int NOT NULL DEFAULT 999,
        created_at  timestamptz DEFAULT now(),
        updated_at  timestamptz DEFAULT now()
      )
    $q$, r.schema_name);
  END LOOP;
END $$;

-----------------------------------------------------------------------
-- 2. Update create_household_schema to include category_overrides
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
-- 3. RPCs
-----------------------------------------------------------------------

-- 3a. List all overrides
CREATE OR REPLACE FUNCTION public.get_category_overrides(p_household_id uuid)
RETURNS TABLE(
  id text, label text, icon text, color text,
  previous_ids text[], sort_order int
) AS $$
DECLARE v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);
  RETURN QUERY EXECUTE format($q$
    SELECT c.id, c.label, c.icon, c.color, c.previous_ids, c.sort_order
    FROM %I.category_overrides c
    ORDER BY c.sort_order, c.id
  $q$, v_schema);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3b. Upsert a single override (create or update label/icon/color)
CREATE OR REPLACE FUNCTION public.upsert_category_override(
  p_household_id uuid,
  p_id text,
  p_label text,
  p_icon text,
  p_color text,
  p_sort_order int DEFAULT 999
) RETURNS void AS $$
DECLARE v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);
  EXECUTE format($q$
    INSERT INTO %I.category_overrides (id, label, icon, color, sort_order, updated_at)
    VALUES (trim($1), trim($2), $3, $4, $5, now())
    ON CONFLICT (id) DO UPDATE SET
      label = EXCLUDED.label,
      icon = EXCLUDED.icon,
      color = EXCLUDED.color,
      sort_order = EXCLUDED.sort_order,
      updated_at = now()
  $q$, v_schema) USING p_id, p_label, p_icon, p_color, p_sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3c. Rename category: updates the override row AND all references in
--     transactions, merchant_knowledge, and guesses. Also appends old id
--     to previous_ids so auto-classify still resolves old merchant knowledge.
CREATE OR REPLACE FUNCTION public.rename_category(
  p_household_id uuid,
  p_old_id text,
  p_new_id text,
  p_new_label text,
  p_new_icon text,
  p_new_color text
) RETURNS void AS $$
DECLARE
  v_schema text;
  v_exists boolean;
  v_prev text[];
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  IF trim(p_old_id) = trim(p_new_id) THEN
    -- Just update metadata, not a real rename
    EXECUTE format($q$
      INSERT INTO %I.category_overrides (id, label, icon, color, updated_at)
      VALUES (trim($1), trim($2), $3, $4, now())
      ON CONFLICT (id) DO UPDATE SET
        label = EXCLUDED.label, icon = EXCLUDED.icon,
        color = EXCLUDED.color, updated_at = now()
    $q$, v_schema) USING p_old_id, p_new_label, p_new_icon, p_new_color;
    RETURN;
  END IF;

  -- Guard: new id must not already exist (as active or previous alias)
  EXECUTE format($q$
    SELECT EXISTS(
      SELECT 1 FROM %I.category_overrides
      WHERE id = trim($1) OR trim($1) = ANY(previous_ids)
    )
  $q$, v_schema) INTO v_exists USING p_new_id;

  IF v_exists THEN
    RAISE EXCEPTION 'Category id "%" already exists or was used before', p_new_id;
  END IF;

  -- Collect previous_ids from old row (if any)
  EXECUTE format($q$
    SELECT COALESCE(previous_ids, '{}') FROM %I.category_overrides WHERE id = trim($1)
  $q$, v_schema) INTO v_prev USING p_old_id;
  v_prev := COALESCE(v_prev, '{}');

  -- Append old id to previous list
  IF NOT (trim(p_old_id) = ANY(v_prev)) THEN
    v_prev := array_append(v_prev, trim(p_old_id));
  END IF;

  -- Delete old override row, insert new one
  EXECUTE format($q$ DELETE FROM %I.category_overrides WHERE id = trim($1) $q$, v_schema)
    USING p_old_id;

  EXECUTE format($q$
    INSERT INTO %I.category_overrides (id, label, icon, color, previous_ids, updated_at)
    VALUES (trim($1), trim($2), $3, $4, $5, now())
  $q$, v_schema) USING p_new_id, p_new_label, p_new_icon, p_new_color, v_prev;

  -- Update all references
  EXECUTE format($q$ UPDATE %I.transactions SET category = trim($1) WHERE category = trim($2) $q$, v_schema)
    USING p_new_id, p_old_id;
  EXECUTE format($q$ UPDATE %I.merchant_knowledge SET category = trim($1) WHERE category = trim($2) $q$, v_schema)
    USING p_new_id, p_old_id;
  EXECUTE format($q$ UPDATE %I.guesses SET category = trim($1) WHERE category = trim($2) $q$, v_schema)
    USING p_new_id, p_old_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3d. Count transactions using a category (for delete guard)
CREATE OR REPLACE FUNCTION public.count_transactions_for_category(
  p_household_id uuid,
  p_category_id text
) RETURNS bigint AS $$
DECLARE
  v_schema text;
  v_count bigint;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);
  EXECUTE format($q$
    SELECT COUNT(*)::bigint FROM %I.transactions WHERE category = trim($1)
  $q$, v_schema) INTO v_count USING p_category_id;
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3e. Delete category (only if zero transactions use it)
CREATE OR REPLACE FUNCTION public.delete_category(
  p_household_id uuid,
  p_category_id text
) RETURNS void AS $$
DECLARE
  v_schema text;
  v_count bigint;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    SELECT COUNT(*)::bigint FROM %I.transactions WHERE category = trim($1)
  $q$, v_schema) INTO v_count USING p_category_id;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete category "%": % transaction(s) still assigned', p_category_id, v_count;
  END IF;

  -- Clean up merchant_knowledge and guesses too
  EXECUTE format($q$ DELETE FROM %I.merchant_knowledge WHERE category = trim($1) $q$, v_schema)
    USING p_category_id;
  EXECUTE format($q$ DELETE FROM %I.guesses WHERE category = trim($1) $q$, v_schema)
    USING p_category_id;
  EXECUTE format($q$ DELETE FROM %I.category_overrides WHERE id = trim($1) $q$, v_schema)
    USING p_category_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3f. Sample transactions for a category (most recent N, any month)
CREATE OR REPLACE FUNCTION public.sample_transactions_for_category(
  p_household_id uuid,
  p_category_id text,
  p_limit int DEFAULT 5
) RETURNS TABLE(
  merchant_raw text,
  merchant_clean text,
  amount numeric,
  tx_date date
) AS $$
DECLARE v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);
  RETURN QUERY EXECUTE format($q$
    SELECT t.merchant_raw, t.merchant_clean, t.amount, t.tx_date
    FROM %I.transactions t
    WHERE t.category = trim($1)
    ORDER BY t.tx_date DESC
    LIMIT $2
  $q$, v_schema) USING p_category_id, p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
