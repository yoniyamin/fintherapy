-- =============================================================================
-- DEV / STAGING — wipe household data only (keeps logins + profile rows)
-- =============================================================================
-- For users + households + profiles + auth, use reset_all_for_new_deployment.sql
-- =============================================================================
-- Run in Supabase SQL Editor when you want a clean slate for uploads/classify/reveal
-- without creating a new Supabase project. Public RPCs and migrations are unchanged.
--
-- After this:
--   1. In the app, create or join a household again (or use Household setup flow).
--   2. Re-upload CSVs; card last-4 lists come from transaction rows + aliases.
--
-- Does NOT delete auth.users or profiles rows; only clears household_id on profiles.
-- =============================================================================

BEGIN;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schema_name FROM public.households LOOP
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', r.schema_name);
  END LOOP;
END $$;

UPDATE public.profiles SET household_id = NULL WHERE household_id IS NOT NULL;

DELETE FROM public.households;

COMMIT;
