-- Revert a classified / transfer / flagged transaction back to pending so it
-- re-enters the classify deck. Used by the Undo + Recent reclassify workflow.
-- Apply after migration_020.

CREATE OR REPLACE FUNCTION public.revert_to_pending(
  p_household_id uuid,
  p_tx_id uuid
) RETURNS void AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    UPDATE %I.transactions
    SET status = 'pending',
        category = NULL,
        classified_by = NULL,
        classified_at = NULL
    WHERE id = $1
  $q$, v_schema) USING p_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.revert_to_pending(uuid, uuid) TO authenticated;
