-- Account type (credit / debit) on account_aliases.
-- Debit cards must be loaded before they can be spent: those positive-amount "load"
-- transactions are auto-marked as own_transfers so they don't show up as spending.
-- Run after migration_015.

-----------------------------------------------------------------------
-- 1. Add account_type column to existing household schemas
-----------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schema_name FROM public.households LOOP
    EXECUTE format($q$
      ALTER TABLE %I.account_aliases
        ADD COLUMN IF NOT EXISTS account_type text
        CHECK (account_type IN ('credit', 'debit'))
    $q$, r.schema_name);
  END LOOP;
END $$;

-----------------------------------------------------------------------
-- 2. Update create_household_schema so NEW households include the column
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_household_schema()
RETURNS trigger AS $$
BEGIN
  EXECUTE format('CREATE SCHEMA %I', new.schema_name);

  EXECUTE format($t$
    CREATE TABLE %I.transactions (
      id uuid primary key default gen_random_uuid(),
      uploaded_by uuid references public.profiles(id),
      merchant_raw text not null,
      merchant_clean text,
      amount numeric(10,2) not null,
      tx_date date not null,
      billing_month text not null,
      account_last4 text,
      category text,
      status text default 'pending'
        check (status in ('auto','manual','pending','flagged','transfer','offset')),
      classified_by uuid references public.profiles(id),
      batch_id uuid,
      created_at timestamptz default now()
    )
  $t$, new.schema_name);

  EXECUTE format($t$
    CREATE TABLE %I.account_aliases (
      last4 text PRIMARY KEY CHECK (char_length(trim(last4)) > 0),
      label text NOT NULL,
      account_type text CHECK (account_type IN ('credit', 'debit')),
      updated_at timestamptz DEFAULT now()
    )
  $t$, new.schema_name);

  EXECUTE format($t$
    CREATE TABLE %I.merchant_knowledge (
      id uuid primary key default gen_random_uuid(),
      merchant_pattern text not null unique,
      category text not null,
      confidence numeric(3,2) default 1.0,
      created_at timestamptz default now()
    )
  $t$, new.schema_name);

  EXECUTE format($t$
    CREATE TABLE %I.guesses (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references public.profiles(id) not null,
      month date not null,
      category text not null,
      predicted_amount numeric(10,2) not null,
      created_at timestamptz default now()
    )
  $t$, new.schema_name);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 3. get_account_aliases: now returns account_type as well
-----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_account_aliases(uuid);

CREATE OR REPLACE FUNCTION public.get_account_aliases(p_household_id uuid)
RETURNS TABLE(last4 text, label text, account_type text) AS $$
DECLARE
  v_schema text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);

  RETURN QUERY EXECUTE format($q$
    SELECT a.last4, a.label, a.account_type
    FROM %I.account_aliases a
    ORDER BY a.last4
  $q$, v_schema);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 4. upsert_account_alias: accepts optional account_type
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_account_alias(
  p_household_id uuid,
  p_last4 text,
  p_label text,
  p_account_type text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_schema text;
  v_last4 text;
  v_type text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);
  v_last4 := trim(p_last4);
  IF v_last4 = '' THEN
    RAISE EXCEPTION 'last4 required';
  END IF;

  v_type := nullif(trim(coalesce(p_account_type, '')), '');
  IF v_type IS NOT NULL AND v_type NOT IN ('credit', 'debit') THEN
    RAISE EXCEPTION 'account_type must be credit or debit';
  END IF;

  EXECUTE format($q$
    INSERT INTO %I.account_aliases (last4, label, account_type, updated_at)
    VALUES ($1, trim($2), $3, now())
    ON CONFLICT (last4) DO UPDATE
      SET label = EXCLUDED.label,
          account_type = COALESCE(EXCLUDED.account_type, %I.account_aliases.account_type),
          updated_at = now()
  $q$, v_schema, v_schema) USING v_last4, p_label, v_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 5. set_account_type: dedicated RPC to set/clear account_type for a card
--    even when the row exists without a label (or to flip credit ↔ debit).
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_account_type(
  p_household_id uuid,
  p_last4 text,
  p_account_type text
) RETURNS void AS $$
DECLARE
  v_schema text;
  v_last4 text;
  v_type text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);
  v_last4 := trim(p_last4);
  IF v_last4 = '' THEN
    RAISE EXCEPTION 'last4 required';
  END IF;

  v_type := nullif(trim(coalesce(p_account_type, '')), '');
  IF v_type IS NOT NULL AND v_type NOT IN ('credit', 'debit') THEN
    RAISE EXCEPTION 'account_type must be credit or debit';
  END IF;

  EXECUTE format($q$
    INSERT INTO %I.account_aliases (last4, label, account_type, updated_at)
    VALUES ($1, $1, $2, now())
    ON CONFLICT (last4) DO UPDATE
      SET account_type = EXCLUDED.account_type,
          updated_at = now()
  $q$, v_schema) USING v_last4, v_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 6. auto_mark_debit_loads: mark positive-amount pending tx on debit
--    accounts as own_transfers. Called from the upload flow right after
--    insert_transactions. Returns the number of rows affected.
--
--    p_billing_month is optional: if given, only that month's loads are
--    marked; if NULL, every pending positive tx on every debit card is
--    marked (used by the retroactive "mark all loads" button).
--    p_account_last4 likewise narrows scope to one card if provided.
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_mark_debit_loads(
  p_household_id uuid,
  p_account_last4 text DEFAULT NULL,
  p_billing_month text DEFAULT NULL
) RETURNS int AS $$
DECLARE
  v_schema text;
  v_count int;
  v_last4 text;
BEGIN
  v_schema := public._resolve_household_schema(p_household_id);
  v_last4 := nullif(trim(coalesce(p_account_last4, '')), '');

  EXECUTE format($q$
    UPDATE %1$I.transactions t
    SET status = 'transfer',
        category = 'own_transfers'
    FROM %1$I.account_aliases a
    WHERE t.account_last4 = a.last4
      AND a.account_type = 'debit'
      AND t.amount > 0
      AND t.status IN ('pending', 'auto')
      AND ($1 IS NULL OR t.account_last4 = $1)
      AND ($2 IS NULL OR t.billing_month = $2)
  $q$, v_schema) USING v_last4, p_billing_month;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------------------
-- 7. Grants — new RPCs default to no EXECUTE for `authenticated`.
-----------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_account_aliases(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_account_alias(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_account_type(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_mark_debit_loads(uuid, text, text) TO authenticated;
