-- ONE-TIME BACKFILL: Award 10 XP per previously classified transaction
-- Run this once in Supabase SQL Editor to retroactively award XP.

DO $$
DECLARE
  r record;
  v_schema text;
BEGIN
  FOR r IN SELECT id, schema_name FROM public.households LOOP
    v_schema := r.schema_name;

    EXECUTE format($q$
      UPDATE public.profiles p
      SET total_xp = COALESCE(sub.earned_xp, 0)
      FROM (
        SELECT classified_by, COUNT(*) * 10 as earned_xp
        FROM %I.transactions
        WHERE status IN ('manual', 'auto')
          AND classified_by IS NOT NULL
        GROUP BY classified_by
      ) sub
      WHERE p.id = sub.classified_by
    $q$, v_schema);
  END LOOP;
END $$;
