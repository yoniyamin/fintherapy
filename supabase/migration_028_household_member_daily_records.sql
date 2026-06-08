-- Per-member peak single-day activity stats for home leaderboard records.

CREATE OR REPLACE FUNCTION public.get_household_member_daily_records(
  p_household_id uuid
) RETURNS TABLE(
  user_id uuid,
  display_name text,
  peak_classified bigint,
  peak_classified_date date,
  peak_uploads bigint,
  peak_uploads_date date,
  peak_bets bigint,
  peak_bets_date date
) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    WITH classify_daily AS (
      SELECT
        t.classified_by AS uid,
        t.classified_at::date AS activity_date,
        COUNT(*)::bigint AS cnt
      FROM %I.transactions t
      WHERE t.status IN ('manual', 'auto', 'transfer')
        AND t.classified_by IS NOT NULL
        AND t.classified_at IS NOT NULL
      GROUP BY t.classified_by, t.classified_at::date
    ),
    classify_peak AS (
      SELECT DISTINCT ON (uid)
        uid,
        cnt AS peak_n,
        activity_date AS peak_d
      FROM classify_daily
      ORDER BY uid, cnt DESC, activity_date DESC
    ),
    upload_daily AS (
      SELECT
        t.uploaded_by AS uid,
        t.created_at::date AS activity_date,
        COUNT(*)::bigint AS cnt
      FROM %I.transactions t
      WHERE t.uploaded_by IS NOT NULL
      GROUP BY t.uploaded_by, t.created_at::date
    ),
    upload_peak AS (
      SELECT DISTINCT ON (uid)
        uid,
        cnt AS peak_n,
        activity_date AS peak_d
      FROM upload_daily
      ORDER BY uid, cnt DESC, activity_date DESC
    ),
    bet_daily AS (
      SELECT
        g.user_id AS uid,
        g.created_at::date AS activity_date,
        COUNT(DISTINCT g.month)::bigint AS cnt
      FROM %I.guesses g
      GROUP BY g.user_id, g.created_at::date
    ),
    bet_peak AS (
      SELECT DISTINCT ON (uid)
        uid,
        cnt AS peak_n,
        activity_date AS peak_d
      FROM bet_daily
      ORDER BY uid, cnt DESC, activity_date DESC
    )
    SELECT
      p.id AS user_id,
      p.display_name,
      COALESCE(cp.peak_n, 0)::bigint AS peak_classified,
      cp.peak_d AS peak_classified_date,
      COALESCE(up.peak_n, 0)::bigint AS peak_uploads,
      up.peak_d AS peak_uploads_date,
      COALESCE(bp.peak_n, 0)::bigint AS peak_bets,
      bp.peak_d AS peak_bets_date
    FROM public.profiles p
    LEFT JOIN classify_peak cp ON cp.uid = p.id
    LEFT JOIN upload_peak up ON up.uid = p.id
    LEFT JOIN bet_peak bp ON bp.uid = p.id
    WHERE p.household_id = $1
    ORDER BY p.display_name
  $q$, v_schema, v_schema, v_schema) USING p_household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_household_member_daily_records(uuid) TO authenticated;
