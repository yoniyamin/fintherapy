-- Add spending_frequency and parent_category_id to category_overrides.
-- Updates get/upsert RPCs, create_household_schema, and adds circular ref guard.
-- Feature C (trip/holiday grouping) was deprioritized — the gap in lettering is intentional.
-- Run after migration_038.

BEGIN;

-------------------------------------------------------------------------
-- 1. Add spending_frequency to existing category_overrides tables
-------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schema_name FROM public.households LOOP
    EXECUTE format($q$
      ALTER TABLE %I.category_overrides
      ADD COLUMN IF NOT EXISTS spending_frequency text NOT NULL DEFAULT 'monthly'
    $q$, r.schema_name);

    EXECUTE format($q$
      ALTER TABLE %I.category_overrides
      DROP CONSTRAINT IF EXISTS category_overrides_spending_frequency_check
    $q$, r.schema_name);

    EXECUTE format($q$
      ALTER TABLE %I.category_overrides
      ADD CONSTRAINT category_overrides_spending_frequency_check
        CHECK (spending_frequency IN ('monthly', 'annual', 'one_off'))
    $q$, r.schema_name);
  END LOOP;
END $$;

-------------------------------------------------------------------------
-- 2. Add parent_category_id to existing category_overrides tables
-------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schema_name FROM public.households LOOP
    EXECUTE format($q$
      ALTER TABLE %I.category_overrides
      ADD COLUMN IF NOT EXISTS parent_category_id text
    $q$, r.schema_name);
  END LOOP;
END $$;

-------------------------------------------------------------------------
-- 3. Update create_household_schema to include new columns
-------------------------------------------------------------------------
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
    INSERT INTO %I.category_overrides (id, label, icon, color, sort_order, spending_frequency, parent_category_id) VALUES
      ('kids_activities', 'Activities', '🎪', 'bg-yellow-500/20 border-yellow-500/40', 181, 'monthly', 'kids_toys'),
      ('kids_clothing',   'Kids Clothing', '👕', 'bg-yellow-500/20 border-yellow-500/40', 182, 'monthly', 'kids_toys'),
      ('school_tuition',  'Tuition',  '🏫', 'bg-violet-500/20 border-violet-500/40', 191, 'annual',  'school_extras'),
      ('school_supplies', 'Supplies', '📓', 'bg-violet-500/20 border-violet-500/40', 192, 'one_off', 'school_extras')
  $t$, new.schema_name);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-------------------------------------------------------------------------
-- 4. get_category_overrides — return new columns
-------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_category_overrides(p_household_id uuid)
RETURNS TABLE(
  id text, label text, icon text, color text,
  previous_ids text[], sort_order int,
  expense_type text, spending_frequency text, parent_category_id text
) AS $$
DECLARE v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);
  RETURN QUERY EXECUTE format($q$
    SELECT c.id, c.label, c.icon, c.color, c.previous_ids, c.sort_order,
           c.expense_type, c.spending_frequency, c.parent_category_id
    FROM %I.category_overrides c
    ORDER BY c.sort_order, c.id
  $q$, v_schema);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-------------------------------------------------------------------------
-- 5. upsert_category_override — accept new columns + circular ref guard
-------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_category_override(
  p_household_id uuid,
  p_id text,
  p_label text,
  p_icon text,
  p_color text,
  p_sort_order int DEFAULT 999,
  p_expense_type text DEFAULT 'discretionary',
  p_spending_frequency text DEFAULT 'monthly',
  p_parent_category_id text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_schema text;
  v_parent_has_parent text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  IF p_parent_category_id IS NOT NULL THEN
    IF trim(p_parent_category_id) = trim(p_id) THEN
      RAISE EXCEPTION 'A category cannot be its own parent';
    END IF;

    EXECUTE format($q$
      SELECT parent_category_id FROM %I.category_overrides WHERE id = trim($1)
    $q$, v_schema) INTO v_parent_has_parent USING p_parent_category_id;

    IF v_parent_has_parent IS NOT NULL THEN
      RAISE EXCEPTION 'Max subcategory depth is 2 — "%" is already a subcategory', p_parent_category_id;
    END IF;
  END IF;

  EXECUTE format($q$
    INSERT INTO %I.category_overrides
      (id, label, icon, color, sort_order, expense_type, spending_frequency, parent_category_id, updated_at)
    VALUES (trim($1), trim($2), $3, $4, $5, $6, $7, $8, now())
    ON CONFLICT (id) DO UPDATE SET
      label = EXCLUDED.label,
      icon = EXCLUDED.icon,
      color = EXCLUDED.color,
      sort_order = EXCLUDED.sort_order,
      expense_type = EXCLUDED.expense_type,
      spending_frequency = EXCLUDED.spending_frequency,
      parent_category_id = EXCLUDED.parent_category_id,
      updated_at = now()
  $q$, v_schema)
  USING p_id, p_label, p_icon, p_color, p_sort_order,
        p_expense_type, p_spending_frequency, p_parent_category_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-------------------------------------------------------------------------
-- 6. Grants
-------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_category_overrides(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_category_override(uuid, text, text, text, text, int, text, text, text) TO authenticated;

COMMIT;
