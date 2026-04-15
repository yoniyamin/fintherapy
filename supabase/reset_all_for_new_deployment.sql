-- =============================================================================
-- FULL RESET — app data + households + ALL Auth users (new deployment smoke test)
-- =============================================================================
-- Run in Supabase → SQL Editor (requires privileges on auth schema).
--
-- Deletes:
--   • Every per-household schema (transactions, merchant_knowledge, guesses, …)
--   • Rows in public.households
--   • All profiles (via CASCADE when auth.users are removed)
--   • All rows in auth.users (logins — sign up again after)
--
-- Does NOT drop public functions/triggers (your migrations stay applied).
-- If DELETE FROM auth.users fails, use Dashboard → Authentication → delete users,
-- then re-run from "UPDATE public.profiles" below, or create a new Supabase project.
--
-- After this runs, existing browser sessions still hold old JWTs: those users no longer
-- exist, so the app will sign out automatically (or sign out once manually) before
-- signing up / logging in again.
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

DELETE FROM auth.users;

COMMIT;
