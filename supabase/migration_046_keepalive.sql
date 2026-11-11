------------------------------------------------------------------------
-- Migration 046: Keep-alive heartbeat for Supabase free plan
------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.keepalive_heartbeat (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pinged_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'github_actions'
);

CREATE INDEX IF NOT EXISTS keepalive_heartbeat_pinged_at_idx
  ON public.keepalive_heartbeat (pinged_at DESC);

ALTER TABLE public.keepalive_heartbeat ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.keepalive_heartbeat FROM PUBLIC, anon, authenticated;

CREATE POLICY keepalive_heartbeat_no_direct_access ON public.keepalive_heartbeat
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.keepalive_ping()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last timestamptz;
BEGIN
  SELECT max(pinged_at) INTO v_last FROM public.keepalive_heartbeat;

  IF v_last IS NULL OR v_last < now() - interval '1 hour' THEN
    INSERT INTO public.keepalive_heartbeat DEFAULT VALUES;
    DELETE FROM public.keepalive_heartbeat WHERE pinged_at < now() - interval '30 days';
    RETURN now();
  END IF;

  RETURN v_last;
END;
$$;

REVOKE ALL ON FUNCTION public.keepalive_ping() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.keepalive_ping() TO anon, authenticated;
