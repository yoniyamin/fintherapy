------------------------------------------------------------------------
-- Migration 044: Read-only aggregate view of session statistics
------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_session_statistics_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_sessions bigint;
  v_total_duration bigint;
  v_section_totals jsonb;
  v_section_session_counts jsonb;
  v_auth_action_counts jsonb;
  v_recent jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT count(*), coalesce(sum(duration_seconds), 0)
    INTO v_total_sessions, v_total_duration
    FROM public.session_statistics;

  SELECT coalesce(jsonb_object_agg(key, total), '{}'::jsonb)
    INTO v_section_totals
    FROM (
      SELECT key, sum(value::bigint) AS total
        FROM public.session_statistics, jsonb_each_text(section_seconds)
       GROUP BY key
    ) agg;

  SELECT coalesce(jsonb_object_agg(key, cnt), '{}'::jsonb)
    INTO v_section_session_counts
    FROM (
      SELECT key, count(*) AS cnt
        FROM public.session_statistics, jsonb_each_text(section_seconds)
       WHERE value::bigint > 0
       GROUP BY key
    ) agg;

  SELECT coalesce(jsonb_object_agg(auth_action, cnt), '{}'::jsonb)
    INTO v_auth_action_counts
    FROM (
      SELECT auth_action, count(*) AS cnt
        FROM public.session_statistics
       GROUP BY auth_action
    ) agg;

  SELECT coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb)
    INTO v_recent
    FROM (
      SELECT id, created_at, updated_at, auth_action, section_seconds, duration_seconds
        FROM public.session_statistics
       ORDER BY created_at DESC
       LIMIT 25
    ) r;

  RETURN jsonb_build_object(
    'total_sessions', v_total_sessions,
    'total_duration_seconds', v_total_duration,
    'section_totals', v_section_totals,
    'section_session_counts', v_section_session_counts,
    'auth_action_counts', v_auth_action_counts,
    'recent_sessions', v_recent
  );
END;
$$;
