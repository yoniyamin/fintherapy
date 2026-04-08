-- ClearTheDeck: Merchant Auto-Detection
-- Run AFTER migration.sql in Supabase SQL Editor.

-----------------------------------------------------------------------
-- Learn a merchant -> category mapping (upsert)
-----------------------------------------------------------------------
create or replace function public.learn_merchant(
  p_household_id uuid,
  p_merchant_raw text,
  p_category text
) returns void as $$
declare
  v_schema text;
  v_pattern text;
begin
  v_schema := public._resolve_household_schema(p_household_id);
  v_pattern := lower(trim(p_merchant_raw));

  execute format($q$
    INSERT INTO %I.merchant_knowledge (merchant_pattern, category, confidence)
    VALUES ($1, $2, 1.0)
    ON CONFLICT (merchant_pattern)
    DO UPDATE SET category = $2, confidence = LEAST(merchant_knowledge.confidence + 0.1, 1.0)
  $q$, v_schema) using v_pattern, p_category;
end;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- Auto-classify pending transactions using merchant_knowledge
-- Returns the count of auto-classified transactions
-----------------------------------------------------------------------
create or replace function public.auto_classify_transactions(
  p_household_id uuid
) returns int as $$
declare
  v_schema text;
  v_count int;
begin
  v_schema := public._resolve_household_schema(p_household_id);

  execute format($q$
    UPDATE %I.transactions t
    SET category = mk.category,
        status = 'auto'
    FROM %I.merchant_knowledge mk
    WHERE t.status = 'pending'
      AND lower(trim(t.merchant_raw)) = mk.merchant_pattern
      AND mk.confidence >= 0.5
  $q$, v_schema, v_schema);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- Get auto-classified transactions (for confirmation)
-----------------------------------------------------------------------
create or replace function public.get_auto_classified_transactions(p_household_id uuid)
returns table(
  id uuid,
  uploaded_by uuid,
  merchant_raw text,
  merchant_clean text,
  amount numeric,
  tx_date date,
  billing_month text,
  account_last4 text,
  category text,
  status text,
  classified_by uuid,
  batch_id uuid,
  created_at timestamptz
) as $$
declare
  v_schema text;
begin
  v_schema := public._resolve_household_schema(p_household_id);

  return query execute format($q$
    SELECT id, uploaded_by, merchant_raw, merchant_clean,
           amount, tx_date, billing_month, account_last4,
           category, status, classified_by, batch_id, created_at
    FROM %I.transactions
    WHERE status = 'auto'
    ORDER BY tx_date DESC
  $q$, v_schema);
end;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- Confirm an auto-classified transaction (mark as manual)
-----------------------------------------------------------------------
create or replace function public.confirm_auto_classified(
  p_household_id uuid,
  p_tx_id uuid,
  p_classified_by uuid
) returns void as $$
declare
  v_schema text;
begin
  v_schema := public._resolve_household_schema(p_household_id);

  execute format($q$
    UPDATE %I.transactions
    SET status = 'manual', classified_by = $1
    WHERE id = $2 AND status = 'auto'
  $q$, v_schema) using p_classified_by, p_tx_id;
end;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- Reject auto-classification (reset to pending, clear category)
-----------------------------------------------------------------------
create or replace function public.reject_auto_classified(
  p_household_id uuid,
  p_tx_id uuid
) returns void as $$
declare
  v_schema text;
begin
  v_schema := public._resolve_household_schema(p_household_id);

  execute format($q$
    UPDATE %I.transactions
    SET status = 'pending', category = NULL
    WHERE id = $1 AND status = 'auto'
  $q$, v_schema) using p_tx_id;
end;
$$ language plpgsql security definer;
