------------------------------------------------------------------------
-- Migration 040: Household budget settings + change log
-- Persists the monthly spending cap (envelope) per household and
-- records an audit trail of budget saves / resets.
------------------------------------------------------------------------

-----------------------------------------------------------------------
-- 1. Create tables in all existing household schemas
-----------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schema_name FROM public.households LOOP
    EXECUTE format($q$
      CREATE TABLE IF NOT EXISTS %I.household_budget_settings (
        id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        monthly_spending_target numeric(10,2) NOT NULL,
        updated_at              timestamptz NOT NULL DEFAULT now(),
        updated_by              uuid REFERENCES public.profiles(id)
      )
    $q$, r.schema_name);

    EXECUTE format($q$
      CREATE TABLE IF NOT EXISTS %I.budget_change_log (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at  timestamptz NOT NULL DEFAULT now(),
        user_id     uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
        action      text NOT NULL CHECK (action IN ('save', 'reset_medians')),
        summary     text NOT NULL,
        snapshot    jsonb NOT NULL
      )
    $q$, r.schema_name);
  END LOOP;
END $$;

-----------------------------------------------------------------------
-- 2. Update create_household_schema to include new tables
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
      id                  text PRIMARY KEY CHECK (char_length(trim(id)) > 0),
      label               text NOT NULL CHECK (char_length(trim(label)) > 0),
      icon                text NOT NULL DEFAULT '📦',
      color               text NOT NULL DEFAULT 'bg-slate-500/20 border-slate-500/40',
      previous_ids        text[] NOT NULL DEFAULT '{}',
      sort_order          int NOT NULL DEFAULT 999,
      expense_type        text NOT NULL DEFAULT 'discretionary'
        CHECK (expense_type IN ('fixed', 'discretionary')),
      spending_frequency  text NOT NULL DEFAULT 'monthly'
        CHECK (spending_frequency IN ('monthly', 'annual', 'one_off')),
      parent_category_id  text,
      created_at          timestamptz DEFAULT now(),
      updated_at          timestamptz DEFAULT now()
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

  EXECUTE format($t$
    CREATE TABLE %I.household_budget_settings (
      id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      monthly_spending_target numeric(10,2) NOT NULL,
      updated_at              timestamptz NOT NULL DEFAULT now(),
      updated_by              uuid REFERENCES public.profiles(id)
    )
  $t$, new.schema_name);

  EXECUTE format($t$
    CREATE TABLE %I.budget_change_log (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at  timestamptz NOT NULL DEFAULT now(),
      user_id     uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
      action      text NOT NULL CHECK (action IN ('save', 'reset_medians')),
      summary     text NOT NULL,
      snapshot    jsonb NOT NULL
    )
  $t$, new.schema_name);

  EXECUTE format($t$
    INSERT INTO %I.category_overrides (id, label, icon, color, sort_order, spending_frequency, parent_category_id) VALUES
      ('kids_activities', 'Activities', '🎪', 'bg-yellow-500/20 border-yellow-500/40', 181, 'monthly', 'kids_toys'),
      ('kids_clothing',   'Kids Clothing', '👕', 'bg-yellow-500/20 border-yellow-500/40', 182, 'monthly', 'kids_toys'),
      ('school_tuition',  'Tuition',  '🏫', 'bg-violet-500/20 border-violet-500/40', 191, 'annual',  'school_extras'),
      ('school_supplies', 'Supplies', '📓', 'bg-violet-500/20 border-violet-500/40', 192, 'one_off', 'school_extras')
  $t$, new.schema_name);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 3. RPCs
-----------------------------------------------------------------------

-- 3a. Get household budget settings (single row or null)
CREATE OR REPLACE FUNCTION public.get_household_budget_settings(
  p_household_id uuid
) RETURNS TABLE(
  id uuid,
  monthly_spending_target numeric,
  updated_at timestamptz,
  updated_by uuid
) AS $$
DECLARE v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);
  RETURN QUERY EXECUTE format($q$
    SELECT s.id, s.monthly_spending_target, s.updated_at, s.updated_by
    FROM %I.household_budget_settings s
    LIMIT 1
  $q$, v_schema);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3b. Upsert household budget settings (insert or update single row)
CREATE OR REPLACE FUNCTION public.upsert_household_budget_settings(
  p_household_id uuid,
  p_monthly_spending_target numeric
) RETURNS uuid AS $$
DECLARE
  v_schema text;
  v_id uuid;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    SELECT s.id FROM %I.household_budget_settings s LIMIT 1
  $q$, v_schema) INTO v_id;

  IF v_id IS NOT NULL THEN
    EXECUTE format($q$
      UPDATE %I.household_budget_settings SET
        monthly_spending_target = $1,
        updated_at = now(),
        updated_by = $2
      WHERE id = $3
    $q$, v_schema) USING p_monthly_spending_target, auth.uid(), v_id;
  ELSE
    v_id := gen_random_uuid();
    EXECUTE format($q$
      INSERT INTO %I.household_budget_settings (id, monthly_spending_target, updated_by)
      VALUES ($1, $2, $3)
    $q$, v_schema) USING v_id, p_monthly_spending_target, auth.uid();
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3c. Get budget change log (newest first, limited)
CREATE OR REPLACE FUNCTION public.get_budget_change_log(
  p_household_id uuid,
  p_limit int DEFAULT 50
) RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  user_id uuid,
  display_name text,
  action text,
  summary text,
  snapshot jsonb
) AS $$
DECLARE v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);
  RETURN QUERY EXECUTE format($q$
    SELECT l.id, l.created_at, l.user_id, p.display_name,
           l.action, l.summary, l.snapshot
    FROM %I.budget_change_log l
    LEFT JOIN public.profiles p ON p.id = l.user_id
    ORDER BY l.created_at DESC
    LIMIT $1
  $q$, v_schema) USING p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3d. Insert budget change log entry
CREATE OR REPLACE FUNCTION public.insert_budget_change_log(
  p_household_id uuid,
  p_action text,
  p_summary text,
  p_snapshot jsonb
) RETURNS uuid AS $$
DECLARE
  v_schema text;
  v_id uuid;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);
  v_id := gen_random_uuid();
  EXECUTE format($q$
    INSERT INTO %I.budget_change_log (id, user_id, action, summary, snapshot)
    VALUES ($1, $2, $3, $4, $5)
  $q$, v_schema) USING v_id, auth.uid(), p_action, p_summary, p_snapshot;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 4. Grants
-----------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_household_budget_settings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_household_budget_settings(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_budget_change_log(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_budget_change_log(uuid, text, text, jsonb) TO authenticated;
