-- PostgREST cannot pick between overloaded get_monthly_summary / get_transactions_by_category
-- when both (uuid,text) and (uuid,text,...) exist. Drop the OLD signatures so only the
-- migration_009 versions (with optional account filter) remain.
-- Run in Supabase SQL Editor after migration_009.

DROP FUNCTION IF EXISTS public.get_monthly_summary(uuid, text);

DROP FUNCTION IF EXISTS public.get_transactions_by_category(uuid, text, text);
