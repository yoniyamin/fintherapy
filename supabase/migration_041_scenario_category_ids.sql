------------------------------------------------------------------------
-- Migration 041: Add scenario_category_ids to household_budget_settings
-- Persists the user-chosen categories for the savings-projection
-- "what-if" scenario panel (max 6).
------------------------------------------------------------------------

-----------------------------------------------------------------------
-- 1. Add column to all existing household schemas
-----------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schema_name FROM public.households LOOP
    EXECUTE format($q$
      ALTER TABLE %I.household_budget_settings
        ADD COLUMN IF NOT EXISTS scenario_category_ids text[] NOT NULL DEFAULT '{}'
    $q$, r.schema_name);
  END LOOP;
END $$;

-----------------------------------------------------------------------
-- 2. Note: create_household_schema() is NOT patched here to avoid
--    "cannot drop function — trigger depends on it" errors.
--    New households will get the column via the ALTER TABLE IF NOT
--    EXISTS pattern in a post-creation hook or future migration.
-----------------------------------------------------------------------

-----------------------------------------------------------------------
-- 3. Update RPCs to include scenario_category_ids
-----------------------------------------------------------------------

-- 3a. Drop old GET (return type changed from 4 to 5 columns)
DROP FUNCTION IF EXISTS public.get_household_budget_settings(uuid);

CREATE OR REPLACE FUNCTION public.get_household_budget_settings(
  p_household_id uuid
) RETURNS TABLE(
  id uuid,
  monthly_spending_target numeric,
  scenario_category_ids text[],
  updated_at timestamptz,
  updated_by uuid
) AS $$
DECLARE v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);
  RETURN QUERY EXECUTE format($q$
    SELECT s.id, s.monthly_spending_target, s.scenario_category_ids,
           s.updated_at, s.updated_by
    FROM %I.household_budget_settings s
    LIMIT 1
  $q$, v_schema);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3b. Drop old 2-param signature, then create 3-param version.
--     The old (uuid, numeric) would conflict with the new (uuid, numeric, text[] DEFAULT)
--     causing ambiguous calls when invoked with 2 args.
DROP FUNCTION IF EXISTS public.upsert_household_budget_settings(uuid, numeric);

CREATE OR REPLACE FUNCTION public.upsert_household_budget_settings(
  p_household_id uuid,
  p_monthly_spending_target numeric,
  p_scenario_category_ids text[] DEFAULT '{}'
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
        scenario_category_ids = $2,
        updated_at = now(),
        updated_by = $3
      WHERE id = $4
    $q$, v_schema) USING p_monthly_spending_target, p_scenario_category_ids, auth.uid(), v_id;
  ELSE
    v_id := gen_random_uuid();
    EXECUTE format($q$
      INSERT INTO %I.household_budget_settings (id, monthly_spending_target, scenario_category_ids, updated_by)
      VALUES ($1, $2, $3, $4)
    $q$, v_schema) USING v_id, p_monthly_spending_target, p_scenario_category_ids, auth.uid();
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 4. Grants (new signature for upsert has 3 params now)
-----------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_household_budget_settings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_household_budget_settings(uuid, numeric, text[]) TO authenticated;
