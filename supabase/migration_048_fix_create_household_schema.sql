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
      classified_at timestamptz,
      batch_id uuid,
      user_note text,
      transfer_kind text
        check (transfer_kind is null or transfer_kind in ('card_funding','salary_in','internal')),
      billing_month_overridden boolean not null default false,
      created_at timestamptz default now()
    )
  $t$, new.schema_name);

  EXECUTE format($t$
    CREATE TABLE %I.account_aliases (
      last4 text PRIMARY KEY CHECK (char_length(trim(last4)) > 0),
      label text NOT NULL,
      account_type text CHECK (account_type IS NULL OR account_type IN ('credit','debit')),
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

  EXECUTE format($t$
    CREATE TABLE %I.category_overrides (
      id                  text PRIMARY KEY CHECK (char_length(trim(id)) > 0),
      label               text NOT NULL CHECK (char_length(trim(label)) > 0),
      icon                text NOT NULL DEFAULT '📦',
      color               text NOT NULL DEFAULT 'bg-slate-500/20 border-slate-500/40',
      previous_ids        text[] NOT NULL DEFAULT '{}',
      sort_order          int NOT NULL DEFAULT 999,
      expense_type        text NOT NULL DEFAULT 'discretionary'
        CHECK (expense_type IN ('fixed', 'discretionary')),
      spending_frequency  text NOT NULL DEFAULT 'monthly'
        CHECK (spending_frequency IN ('monthly', 'annual', 'one_off')),
      parent_category_id  text,
      created_at          timestamptz DEFAULT now(),
      updated_at          timestamptz DEFAULT now()
    )
  $t$, new.schema_name);

  EXECUTE format($t$
    CREATE TABLE %I.category_budgets (
      id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      category_id           text NOT NULL,
      monthly_target        numeric(10,2) NOT NULL,
      is_discretionary      boolean NOT NULL DEFAULT true,
      subject_to_inflation  boolean NOT NULL DEFAULT true,
      valid_from            date,
      valid_to              date,
      notes                 text,
      created_at            timestamptz DEFAULT now(),
      updated_at            timestamptz DEFAULT now()
    )
  $t$, new.schema_name);

  EXECUTE format($t$
    CREATE TABLE %I.household_budget_settings (
      id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      monthly_spending_target numeric(10,2) NOT NULL,
      updated_at              timestamptz NOT NULL DEFAULT now(),
      updated_by              uuid REFERENCES public.profiles(id),
      scenario_category_ids   text[] NOT NULL DEFAULT '{}'
    )
  $t$, new.schema_name);

  EXECUTE format($t$
    CREATE TABLE %I.budget_change_log (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at  timestamptz NOT NULL DEFAULT now(),
      user_id     uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
      action      text NOT NULL CHECK (action IN ('save', 'reset_medians')),
      summary     text NOT NULL,
      snapshot    jsonb NOT NULL
    )
  $t$, new.schema_name);

  EXECUTE format($t$
    INSERT INTO %I.category_overrides (id, label, icon, color, sort_order, spending_frequency, parent_category_id) VALUES
      ('kids_activities', 'Activities', '🎪', 'bg-yellow-500/20 border-yellow-500/40', 181, 'monthly', 'kids_toys'),
      ('kids_clothing',   'Kids Clothing', '👕', 'bg-yellow-500/20 border-yellow-500/40', 182, 'monthly', 'kids_toys'),
      ('school_tuition',  'Tuition',  '🏫', 'bg-violet-500/20 border-violet-500/40', 191, 'annual',  'school_extras'),
      ('school_supplies', 'Supplies', '📓', 'bg-violet-500/20 border-violet-500/40', 192, 'one_off', 'school_extras')
  $t$, new.schema_name);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
