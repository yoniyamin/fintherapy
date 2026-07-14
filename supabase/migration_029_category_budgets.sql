------------------------------------------------------------------------
-- Migration 029: Category budgets table + RPCs
-- Per-category monthly targets with seasonal validity, discretionary
-- flags, and inflation-exclusion support.
------------------------------------------------------------------------

-----------------------------------------------------------------------
-- 1. Create category_budgets table in all existing household schemas
-----------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schema_name FROM public.households LOOP
    EXECUTE format($q$
      CREATE TABLE IF NOT EXISTS %I.category_budgets (
        id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        category_id           text NOT NULL,
        monthly_target        numeric(10,2) NOT NULL,
        is_discretionary      boolean NOT NULL DEFAULT true,
        subject_to_inflation  boolean NOT NULL DEFAULT true,
        valid_from            date,
        valid_to              date,
        notes                 text,
        created_at            timestamptz DEFAULT now(),
        updated_at            timestamptz DEFAULT now()
      )
    $q$, r.schema_name);
  END LOOP;
END $$;

-----------------------------------------------------------------------
-- 2. Update create_household_schema to include category_budgets
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

  EXECUTE format($t$
    CREATE TABLE %I.category_budgets (
      id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      category_id           text NOT NULL,
      monthly_target        numeric(10,2) NOT NULL,
      is_discretionary      boolean NOT NULL DEFAULT true,
      subject_to_inflation  boolean NOT NULL DEFAULT true,
      valid_from            date,
      valid_to              date,
      notes                 text,
      created_at            timestamptz DEFAULT now(),
      updated_at            timestamptz DEFAULT now()
    )
  $t$, new.schema_name);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 3. RPCs
-----------------------------------------------------------------------

-- 3a. Get budgets, optionally filtered to a point-in-time for seasonal lookup.
-- Returns all year-round budgets (valid_from IS NULL) plus any seasonal
-- row whose valid_from..valid_to range covers p_as_of_date.
CREATE OR REPLACE FUNCTION public.get_category_budgets(
  p_household_id uuid,
  p_as_of_date date DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  category_id text,
  monthly_target numeric,
  is_discretionary boolean,
  subject_to_inflation boolean,
  valid_from date,
  valid_to date,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
DECLARE v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  IF p_as_of_date IS NULL THEN
    RETURN QUERY EXECUTE format($q$
      SELECT b.id, b.category_id, b.monthly_target,
             b.is_discretionary, b.subject_to_inflation,
             b.valid_from, b.valid_to, b.notes,
             b.created_at, b.updated_at
      FROM %I.category_budgets b
      ORDER BY b.category_id, b.valid_from NULLS FIRST
    $q$, v_schema);
  ELSE
    RETURN QUERY EXECUTE format($q$
      SELECT b.id, b.category_id, b.monthly_target,
             b.is_discretionary, b.subject_to_inflation,
             b.valid_from, b.valid_to, b.notes,
             b.created_at, b.updated_at
      FROM %I.category_budgets b
      WHERE (b.valid_from IS NULL AND b.valid_to IS NULL)
         OR ($1 >= b.valid_from AND $1 <= b.valid_to)
      ORDER BY b.category_id, b.valid_from NULLS FIRST
    $q$, v_schema) USING p_as_of_date;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3b. Upsert a budget row (insert or update by category + date range match)
CREATE OR REPLACE FUNCTION public.upsert_category_budget(
  p_household_id uuid,
  p_category_id text,
  p_monthly_target numeric,
  p_is_discretionary boolean DEFAULT true,
  p_subject_to_inflation boolean DEFAULT true,
  p_valid_from date DEFAULT NULL,
  p_valid_to date DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_schema text;
  v_id uuid;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    SELECT b.id FROM %I.category_budgets b
    WHERE b.category_id = $1
      AND ((b.valid_from IS NULL AND $2 IS NULL) OR b.valid_from = $2)
      AND ((b.valid_to IS NULL AND $3 IS NULL) OR b.valid_to = $3)
    LIMIT 1
  $q$, v_schema) INTO v_id USING p_category_id, p_valid_from, p_valid_to;

  IF v_id IS NOT NULL THEN
    EXECUTE format($q$
      UPDATE %I.category_budgets SET
        monthly_target = $1,
        is_discretionary = $2,
        subject_to_inflation = $3,
        notes = $4,
        updated_at = now()
      WHERE id = $5
    $q$, v_schema) USING p_monthly_target, p_is_discretionary, p_subject_to_inflation, p_notes, v_id;
  ELSE
    v_id := gen_random_uuid();
    EXECUTE format($q$
      INSERT INTO %I.category_budgets
        (id, category_id, monthly_target, is_discretionary, subject_to_inflation, valid_from, valid_to, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    $q$, v_schema) USING v_id, p_category_id, p_monthly_target, p_is_discretionary, p_subject_to_inflation, p_valid_from, p_valid_to, p_notes;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3c. Delete a budget row by id
CREATE OR REPLACE FUNCTION public.delete_category_budget(
  p_household_id uuid,
  p_budget_id uuid
) RETURNS void AS $$
DECLARE v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);
  EXECUTE format($q$
    DELETE FROM %I.category_budgets WHERE id = $1
  $q$, v_schema) USING p_budget_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
