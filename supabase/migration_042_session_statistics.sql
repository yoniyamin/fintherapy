------------------------------------------------------------------------
-- Migration 042: Anonymous session statistics
------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.session_statistics (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  auth_action text NOT NULL CHECK (auth_action IN ('sign_in', 'sign_up', 'password_recovery')),
  section_seconds jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_seconds integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS session_statistics_created_at_idx
  ON public.session_statistics (created_at DESC);

ALTER TABLE public.session_statistics ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.session_statistics FROM PUBLIC, anon, authenticated;

CREATE POLICY session_statistics_no_direct_access ON public.session_statistics
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.upsert_session_statistics(
  p_id uuid,
  p_auth_action text,
  p_section_seconds jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key text;
  v_raw text;
  v_seconds int;
  v_duration int := 0;
  v_route_keys text[] := ARRAY[
    'home', 'classify', 'reveal', 'analysis', 'bets', 'upload', 'settings', 'household'
  ];
  v_all_keys text[] := ARRAY[
    'home', 'classify', 'reveal', 'analysis', 'bets', 'upload', 'settings', 'household',
    'overview', 'trends', 'breakdown', 'calendar', 'details', 'recurring', 'projections', 'advisor'
  ];
  v_clean jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'id required';
  END IF;

  IF p_auth_action IS NULL OR p_auth_action NOT IN ('sign_in', 'sign_up', 'password_recovery') THEN
    RAISE EXCEPTION 'invalid auth_action';
  END IF;

  IF p_section_seconds IS NULL OR pg_catalog.jsonb_typeof(p_section_seconds) <> 'object' THEN
    RAISE EXCEPTION 'invalid section_seconds';
  END IF;

  IF (SELECT count(*) FROM pg_catalog.jsonb_object_keys(p_section_seconds)) > 24 THEN
    RAISE EXCEPTION 'too many keys';
  END IF;

  FOR v_key, v_raw IN SELECT key, value FROM pg_catalog.jsonb_each_text(p_section_seconds)
  LOOP
    IF NOT v_key = ANY (v_all_keys) THEN
      RAISE EXCEPTION 'invalid section key';
    END IF;
    IF v_raw !~ '^[0-9]{1,9}$' THEN
      RAISE EXCEPTION 'invalid section seconds';
    END IF;
    v_seconds := pg_catalog.GREATEST(0, pg_catalog.LEAST(v_raw::int, 604800));
    IF v_seconds > 0 THEN
      v_clean := v_clean || pg_catalog.jsonb_build_object(v_key, v_seconds);
    END IF;
    IF v_key = ANY (v_route_keys) THEN
      v_duration := v_duration + v_seconds;
    END IF;
  END LOOP;

  INSERT INTO public.session_statistics (id, auth_action, section_seconds, duration_seconds)
  VALUES (p_id, p_auth_action, v_clean, v_duration)
  ON CONFLICT (id) DO UPDATE
    SET section_seconds = EXCLUDED.section_seconds,
        duration_seconds = EXCLUDED.duration_seconds,
        updated_at = pg_catalog.now();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_session_statistics(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_session_statistics(uuid, text, jsonb) TO authenticated;
