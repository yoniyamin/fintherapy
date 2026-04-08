-- ClearTheDeck Database Schema
-- Run this ONCE in Supabase SQL Editor.
-- After this, per-household schemas are created automatically.

-----------------------------------------------------------------------
-- 1. TABLES
-----------------------------------------------------------------------

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  schema_name text unique not null,
  invite_code text unique not null,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid references public.households(id),
  display_name text not null,
  avatar_url text,
  total_xp int default 0,
  created_at timestamptz default now()
);

-----------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY
-- All real data access goes through SECURITY DEFINER RPCs.
-- These policies are minimal: just enough for PostgREST basics.
-----------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-----------------------------------------------------------------------
-- 3. AUTO-CREATE PROFILE ON SIGNUP
-----------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-----------------------------------------------------------------------
-- 4. GET / ENSURE MY PROFILE
-----------------------------------------------------------------------

create or replace function public.get_my_profile()
returns public.profiles as $$
declare
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = auth.uid();

  if v_profile is null then
    insert into public.profiles (id, display_name)
    values (
      auth.uid(),
      coalesce(
        (select raw_user_meta_data->>'display_name' from auth.users where id = auth.uid()),
        (select email from auth.users where id = auth.uid()),
        'User'
      )
    )
    returning * into v_profile;
  end if;

  return v_profile;
end;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- 5. PER-HOUSEHOLD SCHEMA TRIGGER
-- Fires AFTER INSERT on households, creates isolated schema + tables.
-----------------------------------------------------------------------

create or replace function public.create_household_schema()
returns trigger as $$
begin
  execute format('CREATE SCHEMA %I', new.schema_name);

  execute format($t$
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
        check (status in ('auto','manual','pending','flagged')),
      classified_by uuid references public.profiles(id),
      batch_id uuid,
      created_at timestamptz default now()
    )
  $t$, new.schema_name);

  execute format($t$
    CREATE TABLE %I.merchant_knowledge (
      id uuid primary key default gen_random_uuid(),
      merchant_pattern text not null unique,
      category text not null,
      confidence numeric(3,2) default 1.0,
      created_at timestamptz default now()
    )
  $t$, new.schema_name);

  execute format($t$
    CREATE TABLE %I.guesses (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references public.profiles(id) not null,
      month date not null,
      category text not null,
      predicted_amount numeric(10,2) not null,
      created_at timestamptz default now()
    )
  $t$, new.schema_name);

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_household_created on public.households;
create trigger on_household_created
  after insert on public.households
  for each row execute procedure public.create_household_schema();

-----------------------------------------------------------------------
-- 6. HOUSEHOLD RPCs (create + join)
-- Schema name and invite code are generated SERVER-SIDE with retries.
-----------------------------------------------------------------------

-- Generate a random 6-char alphanumeric code (no ambiguous chars)
create or replace function public._generate_code(p_len int default 6)
returns text as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..p_len loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$ language plpgsql;

-- Generate a unique schema name (hh_ + 12 hex chars)
create or replace function public._generate_schema_name()
returns text as $$
begin
  return 'hh_' || encode(gen_random_bytes(6), 'hex');
end;
$$ language plpgsql;

-- CREATE HOUSEHOLD: takes only the name, generates everything else server-side
create or replace function public.create_household(p_name text)
returns jsonb as $$
declare
  v_schema text;
  v_code text;
  v_household public.households;
  v_attempts int := 0;
begin
  if trim(p_name) = '' then
    raise exception 'Household name cannot be empty';
  end if;

  -- Generate unique schema name (retry on collision)
  loop
    v_schema := public._generate_schema_name();
    v_attempts := v_attempts + 1;
    exit when not exists(select 1 from public.households where schema_name = v_schema);
    if v_attempts > 10 then raise exception 'Failed to generate unique schema name'; end if;
  end loop;

  -- Generate unique invite code (retry on collision)
  v_attempts := 0;
  loop
    v_code := public._generate_code();
    v_attempts := v_attempts + 1;
    exit when not exists(select 1 from public.households where invite_code = v_code);
    if v_attempts > 10 then raise exception 'Failed to generate unique invite code'; end if;
  end loop;

  -- Insert household (triggers schema creation)
  insert into public.households (name, schema_name, invite_code)
  values (trim(p_name), v_schema, v_code)
  returning * into v_household;

  -- Link the creator's profile to this household
  update public.profiles
  set household_id = v_household.id
  where id = auth.uid();

  return jsonb_build_object(
    'id', v_household.id,
    'name', v_household.name,
    'invite_code', v_household.invite_code
  );
end;
$$ language plpgsql security definer;

-- JOIN HOUSEHOLD by invite code
create or replace function public.join_household_by_code(p_invite_code text)
returns jsonb as $$
declare
  v_household public.households;
begin
  select * into v_household
    from public.households
    where invite_code = upper(trim(p_invite_code));

  if v_household is null then
    raise exception 'Invalid invite code. Double-check and try again.';
  end if;

  update public.profiles
    set household_id = v_household.id
    where id = auth.uid();

  return jsonb_build_object(
    'id', v_household.id,
    'name', v_household.name
  );
end;
$$ language plpgsql security definer;

-----------------------------------------------------------------------
-- 7. DATA RPCs (per-household schema operations)
-----------------------------------------------------------------------

-- Helper: resolve schema name + verify caller is a member
create or replace function public._resolve_household_schema(p_household_id uuid)
returns text as $$
declare
  v_schema text;
  v_member boolean;
begin
  select schema_name into v_schema
    from public.households where id = p_household_id;
  if v_schema is null then
    raise exception 'Household not found';
  end if;

  select exists(
    select 1 from public.profiles
    where id = auth.uid() and household_id = p_household_id
  ) into v_member;
  if not v_member then
    raise exception 'Access denied';
  end if;

  return v_schema;
end;
$$ language plpgsql security definer;

-- Insert transactions (batch, from CSV upload)
create or replace function public.insert_transactions(
  p_household_id uuid,
  p_rows jsonb
) returns int as $$
declare
  v_schema text;
  v_count int;
begin
  v_schema := public._resolve_household_schema(p_household_id);

  execute format($q$
    INSERT INTO %I.transactions
      (uploaded_by, merchant_raw, amount, tx_date, billing_month, account_last4, status)
    SELECT
      (elem->>'uploaded_by')::uuid,
      elem->>'merchant_raw',
      (elem->>'amount')::numeric,
      (elem->>'tx_date')::date,
      elem->>'billing_month',
      nullif(elem->>'account_last4', ''),
      'pending'
    FROM jsonb_array_elements($1) AS elem
  $q$, v_schema) using p_rows;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer;

-- Get pending transactions
create or replace function public.get_pending_transactions(p_household_id uuid)
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
    WHERE status = 'pending'
    ORDER BY tx_date DESC
  $q$, v_schema);
end;
$$ language plpgsql security definer;

-- Classify a transaction
create or replace function public.classify_transaction(
  p_household_id uuid,
  p_tx_id uuid,
  p_category text,
  p_classified_by uuid
) returns void as $$
declare
  v_schema text;
begin
  v_schema := public._resolve_household_schema(p_household_id);

  execute format($q$
    UPDATE %I.transactions
    SET category = $1, status = 'manual', classified_by = $2
    WHERE id = $3
  $q$, v_schema) using p_category, p_classified_by, p_tx_id;
end;
$$ language plpgsql security definer;

-- Flag a transaction
create or replace function public.flag_transaction(
  p_household_id uuid,
  p_tx_id uuid
) returns void as $$
declare
  v_schema text;
begin
  v_schema := public._resolve_household_schema(p_household_id);

  execute format($q$
    UPDATE %I.transactions SET status = 'flagged' WHERE id = $1
  $q$, v_schema) using p_tx_id;
end;
$$ language plpgsql security definer;
