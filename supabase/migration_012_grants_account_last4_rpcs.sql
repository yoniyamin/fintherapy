-- New RPCs created in the SQL editor often default to no EXECUTE for `authenticated`,
-- so supabase.rpc(...) fails with permission denied while the hook returns [].
-- Run after migration_011.

GRANT EXECUTE ON FUNCTION public.get_distinct_account_last4_for_household(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_distinct_account_last4_for_month(uuid, text) TO authenticated;
