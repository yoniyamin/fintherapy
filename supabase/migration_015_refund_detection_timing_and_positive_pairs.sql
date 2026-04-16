-- Refund offset: run before auto-classify on upload (see UploadPage) and cover:
-- 1) Same merchant, opposite signed amounts (original behavior), for pending OR auto.
-- 2) Same merchant, equal positive amounts when exactly one description matches refund-like text
--    (many banks show credits as positive numbers).

CREATE OR REPLACE FUNCTION public.detect_and_offset_refunds(
  p_household_id uuid
) RETURNS int AS $$
DECLARE
  v_schema text;
  v_count int;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  EXECUTE format($q$
    WITH
    neg_pairs AS (
      SELECT DISTINCT ON (a.id)
        a.id AS purchase_id,
        b.id AS refund_id
      FROM %1$I.transactions a
      JOIN %1$I.transactions b
        ON lower(trim(a.merchant_raw)) = lower(trim(b.merchant_raw))
        AND a.amount = -b.amount
        AND a.id < b.id
        AND a.status IN ('pending', 'auto')
        AND b.status IN ('pending', 'auto')
      ORDER BY a.id, b.id
    ),
    pos_pairs AS (
      SELECT DISTINCT ON (a.id)
        a.id AS purchase_id,
        b.id AS refund_id
      FROM %1$I.transactions a
      JOIN %1$I.transactions b
        ON lower(trim(a.merchant_raw)) = lower(trim(b.merchant_raw))
        AND a.amount = b.amount
        AND a.amount > 0
        AND a.id < b.id
        AND a.status IN ('pending', 'auto')
        AND b.status IN ('pending', 'auto')
        AND (
          (
            a.merchant_raw ~* 'refund|reversal|rebate|chargeback|returned payment|credit voucher|acct credit'
            AND b.merchant_raw !~* 'refund|reversal|rebate|chargeback|returned payment|credit voucher|acct credit'
          )
          OR
          (
            b.merchant_raw ~* 'refund|reversal|rebate|chargeback|returned payment|credit voucher|acct credit'
            AND a.merchant_raw !~* 'refund|reversal|rebate|chargeback|returned payment|credit voucher|acct credit'
          )
        )
      ORDER BY a.id, b.id
    ),
    matched_ids AS (
      SELECT purchase_id AS id FROM neg_pairs
      UNION
      SELECT refund_id AS id FROM neg_pairs
      UNION
      SELECT purchase_id AS id FROM pos_pairs
      UNION
      SELECT refund_id AS id FROM pos_pairs
    )
    UPDATE %1$I.transactions t
    SET status = 'offset'
    FROM matched_ids m
    WHERE t.id = m.id
  $q$, v_schema);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count / 2;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
