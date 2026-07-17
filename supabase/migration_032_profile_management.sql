-- migration_032_profile_management.sql
-- v1.5.0: RPCs for profile & household management from SettingsPage.

-- ============================================================
-- 1. Update own display name
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_display_name(
  p_name text
) RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET display_name = trim(p_name)
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. Update household name (membership-checked)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_household_name(
  p_household_id uuid,
  p_name text
) RETURNS void AS $$
DECLARE
  v_member boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND household_id = p_household_id
  ) INTO v_member;

  IF NOT v_member THEN
    RAISE EXCEPTION 'Not a member of this household';
  END IF;

  UPDATE public.households
  SET name = trim(p_name)
  WHERE id = p_household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. Leave household (nullifies household_id on own profile)
-- ============================================================
CREATE OR REPLACE FUNCTION public.leave_household(
  p_household_id uuid
) RETURNS void AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  UPDATE public.profiles
  SET household_id = NULL
  WHERE id = v_uid AND household_id = p_household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
