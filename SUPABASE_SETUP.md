# Supabase Setup Guide

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Choose an organization, name the project (e.g. "ClearTheDeck"), set a database password, and pick a region
4. Wait for the project to finish provisioning

## 2. Configure Environment Variables

1. In the Supabase dashboard, go to **Settings > API**
2. Copy the **Project URL** and the **anon (public)** key
3. In the project root, copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

4. Paste your values:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

## 3. Run the Database Migration

1. In the Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Open `supabase/migration.sql` from this repo and paste the entire contents
4. Click **Run**

This creates:
- **Public tables**: `households` and `profiles` (shared across all households)
- **Trigger**: automatically creates a dedicated PostgreSQL schema (`hh_<uid>`) for each new household with its own `transactions`, `merchant_knowledge`, and `guesses` tables
- **RPC functions**: `insert_transactions`, `get_pending_transactions`, `classify_transaction`, `flag_transaction`, `join_household_by_code` — these bridge PostgREST to the per-household schemas

## 4. Enable Auth

1. Go to **Authentication > Providers**
2. Ensure **Email** provider is enabled (it is by default)
3. Optionally disable "Confirm email" for faster local development under **Authentication > Settings**

## 5. Start the App

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

## Architecture Note

Each household gets its own PostgreSQL schema (e.g. `hh_a1b2c3d4e5f6`). This provides:
- **Data isolation**: one household's data is completely separate from another's
- **Clean scaling**: no `household_id` column needed in per-household tables
- **Security**: RPC functions verify membership before accessing any schema

The schema is created automatically via a Postgres trigger when a user creates a new household — no manual SQL needed after the initial migration.
