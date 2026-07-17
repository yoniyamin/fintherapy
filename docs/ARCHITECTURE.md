# SpentWhatt — Architecture & Product Documentation

> **Package:** `spentwhatt` v1.1.0
> **UI branding:** Financial Therapy / FinTherapy
> **Legacy name:** ClearTheDeck (seen in early migration comments)

A gamified household expense app. Partners upload bank CSVs, swipe-classify transactions together, reveal monthly spending, place prediction bets, and run multi-month financial analysis — with XP, leaderboards, and PWA install support.

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [User Workflow](#2-user-workflow)
3. [Upload Flow](#3-upload-flow)
4. [Classification Flow](#4-classification-flow)
5. [Auto-Classification](#5-auto-classification)
6. [Gamification](#6-gamification)
7. [Reveal — Monthly Snapshot](#7-reveal--monthly-snapshot)
8. [Analysis — Financial Health Check](#8-analysis--financial-health-check)
9. [Reveal vs Analysis](#9-reveal-vs-analysis)
10. [Bets — Prediction Game](#10-bets--prediction-game)
11. [UI & UX Design](#11-ui--ux-design)
12. [Data Models](#12-data-models)
13. [API Surface](#13-api-surface)
14. [Authentication & Authorization](#14-authentication--authorization)
15. [Configuration & Setup](#15-configuration--setup)
16. [Directory Structure](#16-directory-structure)
17. [Testing](#17-testing)
18. [Recommendations & Known Issues](#18-recommendations--known-issues)

---

## 1. Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite 8 |
| Routing | React Router 7 (`createBrowserRouter`) |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`) |
| State | Zustand (`classificationStore`), React Context (`AuthProvider`), custom hooks |
| Animation | Framer Motion, anime.js, canvas-confetti |
| Charts | Recharts, D3 (PDF export only) |
| Exports | jsPDF (PDF), pptxgenjs (PowerPoint), PapaParse (CSV import) |
| PWA | `vite-plugin-pwa` — standalone, auto-update service worker |
| Database | Supabase (PostgreSQL + PostgREST RPC + Auth + Realtime Presence) |
| Serverless | Vercel — one function: Brave Search proxy (`api/search.ts`) |

### Data Flow

```
Browser (React SPA)
  ├── Supabase Auth ──── email/password sign up/in/out, password reset
  ├── Supabase RPC ───── SECURITY DEFINER functions (all household data)
  ├── Supabase Realtime ─ Presence channel (who's classifying)
  └── /api/search ─────── Vercel serverless → Brave Search API
```

There is **no custom backend**. All household data access goes through ~50+ PostgreSQL RPC functions. The client never queries per-household tables directly. One Vercel serverless function proxies Brave Search so the API key stays server-side.

### Schema Isolation

Each household gets its own PostgreSQL schema (`hh_<hex>`). Transaction tables live inside that schema — no `household_id` column on rows. Membership is verified inside every RPC via `_resolve_household_schema`.

---

## 2. User Workflow

### Onboarding

1. **Sign up** (`/signup`) — display name, email, password → Supabase Auth creates user + auto-inserts `profiles` row via trigger.
2. **AuthGuard** redirects to `/household` if `profile.household_id` is null.
3. **Create** household (name → server generates schema + 6-char invite code) **or join** existing household via invite code.
4. **Home** — invite partner by sharing the code.
5. Partner **signs up** → **joins** with code → shares the same household data.

### Monthly Cycle

```
Upload CSV(s)
    ↓
Auto-pipeline: dedup → refund detection → auto-classify → debit-load marking
    ↓
Classify (solo or together via realtime presence)
  ├── Swipe right → pick category (or confirm prediction) → learn merchant → XP
  ├── Swipe left → flag as "No idea" → partner resolves later
  └── Mark as transfer → exclude from spending
    ↓
(Optional) Place bets on 4 category totals before month closes
    ↓
Reveal (unlocks at ≥80% classified; celebration at 100%)
  └── Pie chart, trends, leaderboard, drill-down, reclassify, export
    ↓
Analysis (multi-month health check, no gate)
  └── 15 panels, rule-based insights, budgets, recurring, exports
    ↓
Bet results (after month fully classified)
```

---

## 3. Upload Flow

**Route:** `/upload` — single page, 3-step wizard (Select file → Review → Upload).

### Step 0 — Select File

- **Account last-4** input (optional, numeric, max 4 digits) — applied uniformly to every row in the CSV.
- **Saved card picklist** — union of previously aliased cards + any last-4 seen in transactions. Selecting from dropdown fills the input.
- **Billing month repair** tool — one-time sync of `billing_month` from `tx_date` (for legacy data).
- **File picker** — accepts `.csv` only.

### Step 1 — Review

On file select, the client:

1. **Auto-detects delimiter** — scores first line for `;`, `,`, `\t`; picks highest.
2. **Parses 5-row preview** via PapaParse with detected delimiter.
3. **Auto-maps columns** via synonym matching (EN / ES / CA headers):

| Field | Example synonyms |
|-------|-----------------|
| Merchant | `description`, `concepto`, `concepte`, `beneficiario`, `comercio` |
| Date | `date`, `fecha`, `fecha valor`, `data`, `data operacio` |
| Amount | `amount`, `importe`, `import`, `cantidad`, `quantitat` |

Headers are normalized: strip BOM, trim, lowercase, NFD + strip accents.

4. If merchant or amount cannot be detected → **column mapping modal opens automatically**.
5. User can always open "Choose columns…" to override auto-detection.

**Review UI shows:**
- Green/red column badges (mapped / not mapped)
- Context pills: months detected, card label, credit/debit type
- Card type prompt: if last-4 is 4 digits and type unknown → modal asks credit vs debit (affects debit-load auto-marking)
- 5-row preview table
- Upload button (disabled until merchant + amount mapped)

### Step 2 — Upload & Post-Processing

Full CSV parse → row mapping → filtering (drop empty merchant or zero amount).

**Amount parsing** handles: EU/US decimal conventions, parenthetical negatives `(123.45)`, unicode minus, currency symbol stripping. Refund-like descriptions with positive amounts are negated client-side.

**Date parsing** tries EU `DD/MM/YYYY`, ISO `YYYY-MM-DD`, US `MM/DD/YYYY`, then falls back to today's date. Missing date column → every row gets today.

**Server pipeline (sequential):**

```
insert_transactions (dedup: same merchant + date + month + last4 + |amount|)
    ↓ (if rows inserted)
detect_and_offset_refunds (pair matching purchases with refunds → status 'offset')
    ↓
auto_classify_transactions (merchant_knowledge match → status 'auto')
    ↓ (if debit card)
auto_mark_debit_loads (positive amounts on debit = card loads → status 'transfer')
```

**Success screen** shows: inserted count, duplicates skipped, auto-classified count, debit loads, months touched, and link to `/classify`.

Account last-4 is **kept** after upload for multi-file convenience; file/preview state is cleared.

---

## 4. Classification Flow

**Routes:** `/classify` (pending + auto queue), `/classify/no-idea` (flagged queue).

Both render `SwipeDeck`. Mode is derived from the URL path.

### Transaction Grouping

Transactions are grouped into **stacks** by `lowercase(merchant_raw) + billing_month`. Same merchant in different months → separate stacks. The pending deck merges `pending` + `auto` status rows before grouping.

Up to 3 stacks render simultaneously; the top card is interactive.

### Card UI

Each card shows:
- Billing month badge
- Stack position ("Stack N of M")
- Date range (single date or oldest–newest)
- Merchant name (clean or raw)
- **Predicted category** pill (only when all txs in stack are `auto` with same category)
- Smart Stack badge (if ≥3 transactions)
- Total amount (EUR)
- Per-line breakdown (individual amounts; account label per line if multi-card, unscoped)
- Note preview (truncated)
- Card-load hint (positive amount on debit card → "Looks like a card load" + transfer CTA)

### Swipe Mechanics

| Gesture | Pending Deck | No-Idea Deck |
|---------|-------------|--------------|
| **Swipe right** (≥90px or velocity ≥500) | Predicted → confirm auto-classify (5 XP/tx). Not predicted → open category picker (10 XP/tx). | Open category picker |
| **Swipe left** | Flag as "No idea" → moves to flagged queue | Skip → rotate stack to back of deck |
| **Swipe up** (predicted only) | Open category picker to override prediction | N/A |

### Button Actions

| Button | Effect |
|--------|--------|
| 📝 Note | Opens note modal (saved to all txs in stack) |
| 💸 Transfer | Mark as own-account transfer (pending deck only) |
| 🔍 Search | Opens Brave Search panel for merchant identification |

### Undo

After every classify / flag / transfer: a 5-second toast with **Undo** calls `revert_to_pending` and re-adds transactions to the deck.

### Scope Filters

- **Account filter** — persisted in sessionStorage; auto-selects card whose alias matches user's display name.
- **Billing month filter** — month chips shown when ≥2 months in scoped deck; defaults to oldest pending month.
- **ClassifyScopeBar** — bottom sheet with card list + month list (stack counts per month).

Switching card can auto-set month to the oldest pending month for that card.

### "Recent & Revise" Panel

Opened via **Recent** button. Two sources merged:

1. **Session history** — actions from current session (reversed chronological).
2. **History range** — last 7 days of classified transactions from DB, grouped by merchant + month + category.

Each row shows merchant, count, total amount, timestamp, state badge.

**Actions per row:** Change category, Mark as transfer, Send to No idea, Back to deck (revert to pending).

### Intermediate States

- **Month caught up** — current month scope empty, other months remain → confetti + auto-advance after 3.2s.
- **Card caught up** — filtered card empty, session has actions → celebration + per-user breakdown.
- **Deck cleared** — household queue empty + at least one action this session → verification refetch → `DeckClearedScreen` with confetti, stats (classified count, stacks, smart stacks, XP), and CTA to Reveal.

### Realtime Presence

Supabase Presence channel `classify:{householdId}` — shows avatar initials + "N classifying together" when multiple users are online.

### In-Deck Editors

- **Category editor** (gear icon) — rename, recolor, add/delete household categories.
- **Account editor** (in scope bar) — edit card display label + credit/debit type.

---

## 5. Auto-Classification

### How It Works

The `merchant_knowledge` table (per-household schema) stores learned mappings:

| Column | Purpose |
|--------|---------|
| `merchant_pattern` | Lowercase trimmed merchant text (unique) |
| `category` | Category ID |
| `confidence` | Float, default 1.0, capped at 1.0 |

### Learning

`learn_merchant` is called after every manual classify, auto confirm, and reclassify from the Recent panel. It upserts the merchant pattern → category mapping. On conflict, it updates the category and bumps confidence by +0.1 (capped at 1.0).

### Applying

`auto_classify_transactions` runs **only at upload time** (not on classify page load). It matches pending transactions whose `lower(trim(merchant_raw))` exactly matches a knowledge entry with `confidence >= 0.5`, setting their status to `auto` and assigning the learned category.

### In the UI

- Auto-classified transactions appear as **predicted** cards (green pill with category icon).
- **Swipe right** on a fully predicted stack = confirm → `confirm_auto_classified` + `learn_merchant` + 5 XP per tx.
- **Swipe up** or picking a different category = override → manual `classify_transaction` + learn new mapping + 10 XP per tx.
- The `reject_auto_classified` RPC exists but is **not wired in the UI** — wrong predictions are overridden via manual classify or flagging.

---

## 6. Gamification

### XP System

| Action | XP per transaction |
|--------|-------------------|
| Manual classify (pick category) | 10 |
| Confirm auto-classification | 5 |

`XP_VALUES` contains `CLASSIFY_MANUAL` (10) and `CLASSIFY_EASY` (5). Unused streak/auto constants were removed in v1.6.0.

### Levels

25 level titles with increasing XP thresholds per segment (80 XP early → 1000 XP late):

| Range | Example Titles |
|-------|---------------|
| 1–5 | Receipt Rookie → Swipe Cadet |
| 10–15 | Budget Knight → Spreadsheet Sorcerer |
| 20–25 | Chief Financial Ninja → Legendary Accountant |

### Encouragement Bursts (Session-Scoped)

Triggered on successful classify, with priority ordering and 45-second minimum gap:

| Kind | Trigger | Animation |
|------|---------|-----------|
| Level-up | XP crosses level threshold | Medal/trophy + confetti |
| Rank-up | Pass a household member on XP leaderboard (≥2 members) | Medal + confetti |
| Milestone | Classified tx count hits 10, then every +15, +20, +25… | High-five / star / trophy |
| Time | ≥3 min active classify time (gaps <45s) | Star |

There is **no multi-day streak** system. The `flame` color denotes warnings (no-idea queue), not streaks.

### Leaderboard & Podium

- **Leaderboard** — household members ranked by total XP; medal emojis for top 3; expandable rows with today's stats, all-time records, personal bests.
- **HouseholdPodium** — compact 2-person podium on the Home card (when ≥2 members).

---

## 7. Reveal — Monthly Snapshot

**Route:** `/reveal`

### Purpose

The monthly "payoff" after classifying transactions — a single-month spending breakdown with household leaderboard.

### Access Gate

Access is controlled by `get_month_classification_stats`:

| Condition | UI |
|-----------|-----|
| No transactions for month | "No data" + link to Upload |
| >20% unclassified | **Blocked** — "Not ready yet" with progress bar showing % classified |
| 100% classified (not dismissed) | **Celebration screen** — confetti burst + side cannons, "All N transactions for [month] are classified!", "Reveal the numbers" button |
| ≥80% classified | Full dashboard |

### Controls

- **Month picker** — last 12 months, default = current month.
- **Card filter** — multi-select by card last-4; includes alias editing and "Mark loads" for debit transfers.
- **CSV export** — classified transactions for selected month.
- **Slides** — scrollable in-app preview → downloadable PPTX.

### Dashboard Content

**Summary card:**
- Household income (click to edit, saved via RPC)
- Total spent (respects own-transfers toggle)
- "Hide internal transfers" toggle + help text
- Spending transaction count
- Free income = income − total (with savings rate progress bar, if income set)

**Spending chart** (donut + list):
- Donut: positive net spend by category (Recharts pie).
- Category list: icon, label, tx count, amount, percentage — all clickable for drill-down.

**Monthly trend:**
- Bar chart of all monthly totals; selected month highlighted green.

**Leaderboard:**
- Household members ranked by XP with expandable classify counts.

### Drill-Down

Clicking a category opens `CategoryDetail` bottom sheet:
- Transaction list (merchant, card, date, amount).
- **Move** → reclassify to another category (learns new merchant mapping).
- **💸** → mark as transfer.
- **Note** → user note (max 2000 chars).

### Own-Transfers Toggle

Default: **hidden** (`includeOwnTransfers=false`). When hidden:
- Filtered from total spent, donut, monthly trend.
- Still visible in category list for drill-down transparency.

### Exports

| Format | Content |
|--------|---------|
| CSV | Classified transactions: Date, Merchant, Clean Name, Amount, Category, Status, Month, Account, Note |
| PPTX | Title, Overview, Category breakdown, Top category vs previous month, Top transactions, Monthly trend, Income vs spending, Highlights |

---

## 8. Analysis — Financial Health Check

**Route:** `/analysis`

### Purpose

Multi-month deep-dive with rule-based "advisor" insights, budgets, recurring charge detection, and richer exports. **No classification gate** — only needs data to exist.

### Controls

- **MonthRangePicker** — single, multi, range, or year modes; presets (Last 3m, 6m, YTD); defaults to previous 3 completed months.
- **Report config** (gear icon) — toggle each panel on/off; configure inflation rate and savings goals.

### Panels (15 Total)

Each panel has a minimum month requirement and can be toggled by the user.

| Panel | Min Months | Description |
|-------|-----------|-------------|
| Headline Banner | 1 | Rule-generated sentence + green/amber/red health verdict |
| KPI Cards | 1 | 2×2: avg monthly spend, savings rate, biggest mover, spending predictability |
| Fixed vs Discretionary | 1 | Split bar by category expense type; discretionary budget vs actual |
| Category Trends | 2 | Line chart of top 5 categories over time; income reference line |
| Delta Drivers | 2 | Categories with ≥25% change first→last month; top 3 transactions each |
| Member Spending | 1 | Spending by card (needs ≥2 cards) |
| Top Vendors | 3 | Top merchants per category; "paid from" card percentage |
| Card × Category | 3 | "Who Pays What" — per category, which card paid what % |
| Budget vs Actual | 3 | Median actual vs budget target per category; edit opens budget modal |
| Savings Projection | 3 | Income − fixed/variable (inflation-adjusted) − savings goals |
| Recurring Charges | 1 | Heuristic detection (≥3 charges, same merchant, similar amount, CV <0.3) |
| Comparison Table | 2 | Month-over-month by category; bars/cards view; drill-down + reclassify |
| Calendar Heatmap | 2 | GitHub-style daily spend intensity; day-of-week pattern note |
| Advisor Notes | 1 | Up to 8 rule-based insight cards |
| Velocity Gauge | 1 | Current-month burn rate vs income (only if current month in selection) |

### Rule-Based Advisor (Not AI)

All insights are generated deterministically in `advisorInsights.ts`:

- **Headline:** Overspend/save/break-even vs average; names top 2 category drivers.
- **Health verdict:** Green (≥10% savings rate), amber (0–10%), red (negative).
- **Delta drivers:** Categories with ≥25% change, ≥€30 prior, with top 3 transactions.
- **Insights (up to 8 of 10 rules):** Fixed vs discretionary budget, recurring charge totals, micro-spend patterns, per-card breakdown, overspending/saver, biggest category rise, category dominance (>35%), spending predictability (CV >0.3), weekend vs weekday (>40% higher), best/worst month.

### Recurring Detection

`recurringDetector.ts` groups by merchant (uppercase), clusters amount tiers (12% tolerance), flags as recurring if same tier in ≥3 months with CV <0.3.

### Exports

| Format | Variants |
|--------|---------|
| CSV | All classified transactions across selected months |
| PPTX | Multi-month slide deck: big picture, trajectory, donut, trends, top txs, recurring, insights |
| PDF (mobile) | Portrait, D3 SVG→PNG charts, jsPDF multi-page |
| PDF (desktop) | Landscape variant |

PDF and PPTX respect the report config toggles.

---

## 9. Reveal vs Analysis

| Dimension | Reveal | Analysis |
|-----------|--------|----------|
| **Scope** | Single billing month | Multi-month (default: prior 3) |
| **Gate** | ≥80% classified required | No classification gate |
| **Celebration** | 100% classified → confetti | None |
| **Primary hook** | `useReveal` | `useMultiMonthReveal` |
| **Income** | Editable on page | Read-only |
| **Own-transfers** | User-togglable | Always excluded |
| **Card filter** | Yes | No |
| **Leaderboard** | Yes (XP-based) | No |
| **Insights** | None | Rule-based advisor (15 panels) |
| **Budgets** | No | Yes (budget editor) |
| **Recurring** | No | Yes (heuristic detection) |
| **Drill-down** | Category → transaction list + reclassify | Comparison table → category detail |
| **Exports** | CSV, PPTX | CSV, PPTX, PDF (mobile + desktop) |

**Mental model:** Reveal is the monthly "unlock moment" tied to classification progress — optimized for one month, card filtering, income entry, and gamification. Analysis is the longitudinal financial health report — trends, drivers, budgets, and advisor notes — with no gate and richer exports.

---

## 10. Bets — Prediction Game

**Route:** `/bets`

### How It Works

1. Each household+month gets **4 categories** chosen deterministically (seeded shuffle based on household ID + month string).
2. While the month is incomplete → **Predict tab**: each member enters EUR predictions for the 4 categories.
3. Predictions are submitted via `submit_bets` (replaces prior submission for the same month).
4. After all transactions are classified → **Results tab**: compare predictions vs actuals.
5. Per-category and overall winners displayed; confetti on submit.

### Household Bet Status

Shows which members have submitted predictions for the selected month.

---

## 11. UI & UX Design

### Visual Language

- **Dark-only** — no light mode toggle. Background: `surface-900` (`#0f172a`).
- **Glassmorphism** — rounded cards with white border/gradient, backdrop blur, deep shadows (`ui.glass`).
- **Duolingo-inspired** buttons — green fill, 3px bottom border, press translate-y effect.
- **Jewel-tone accents** on dark slate: `duo-green` (actions), `gem` (XP/avatars), `flame` (warnings), `ice` (info/upload).
- **Typography:** Inter (400–800) from Google Fonts.

### App Shell

- **5-tab bottom bar:** Home, Classify, Reveal, Analysis, Bets.
- Active tab: `duo-green` text + green glow blur. Inactive: `surface-500`.
- Upload is in the **tab bar** as the second tab (added v1.6.0), and also linked from the Home page CTA.
- `OrganicBackdrop`: animated jewel-tone blobs, gradient, SVG wave texture behind all screens.

### Animation Systems

| System | Usage |
|--------|-------|
| **Framer Motion** | Page entrances, `AnimatePresence` enter/exit, drag gestures (swipe cards), progress bars, `whileTap` press effects. Used in 40+ files. |
| **anime.js** | Classify encouragement celebrations (high-five, medal timelines), deck-cleared animation. |
| **canvas-confetti** | Reveal 100% celebration, bet submission. |
| **Custom Confetti component** | Framer Motion particles in brand colors for classify encouragement, deck cleared, milestones. |

### Responsive Design

Mobile-first, phone-centric:
- Content width caps at `max-w-lg` (pages), `max-w-sm` (auth/forms).
- PWA manifest locks `orientation: portrait`.
- Minimal `sm:` breakpoint usage (grid columns in pickers/leaderboard). No tablet/desktop adaptive layouts — wider screens get centered phone-width columns.
- Safe-area CSS variables for notched devices: `--pwa-tab-safe-bottom`, `--shell-tab-clearance`.

### PWA

- Install prompt: Android `beforeinstallprompt` native, iOS share-sheet instructions.
- Service worker: `registerType: 'autoUpdate'`, caches all static assets.
- Standalone display mode with portrait orientation.

### Common UI Patterns

- **Modals/sheets:** `createPortal` + backdrop click; bottom-sheet on mobile, centered on wider screens.
- **Scroll report system:** Full-screen portal with sticky header, section title crossfade, scroll progress bar.
- **Loading:** Three-stage boot progress bar in AuthGuard; page-level spinners; inline spinners on exports.
- **Errors:** `ui.dangerBanner` for form errors; amber for session-expired; green for success states.

---

## 12. Data Models

### Public Schema

**`households`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `name` | text | Display name |
| `schema_name` | text | e.g. `hh_a1b2c3d4e5f6` |
| `invite_code` | text | 6-char alphanumeric |
| `monthly_income` | numeric | Optional |
| `created_at` | timestamptz | |

**`profiles`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | FK → `auth.users` |
| `household_id` | uuid | FK → households, nullable until setup |
| `display_name` | text | |
| `avatar_url` | text | Nullable |
| `total_xp` | int | Gamification |
| `ui_prefs` | jsonb | Analysis config, savings goals, inflation |
| `created_at` | timestamptz | |

### Per-Household Schema (`hh_*`)

**`transactions`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `uploaded_by` | uuid | FK profiles |
| `merchant_raw` | text | From bank CSV |
| `merchant_clean` | text | Optional cleaned name |
| `amount` | numeric(10,2) | Raw bank amount |
| `tx_date` | date | Transaction date |
| `billing_month` | text | `YYYY-MM` bucket |
| `account_last4` | text | Card/account identifier |
| `category` | text | Category ID |
| `status` | text | See below |
| `classified_by` | uuid | Who classified |
| `classified_at` | timestamptz | When classified |
| `batch_id` | uuid | Upload batch |
| `user_note` | text | User annotation |
| `transfer_kind` | text | `card_funding`, `salary_in`, `internal` |
| `created_at` | timestamptz | |

**Transaction Statuses:**

| Status | Meaning |
|--------|---------|
| `pending` | Awaiting classification |
| `auto` | Auto-classified via merchant knowledge, awaiting confirm/reject |
| `manual` | User classified |
| `flagged` | "No idea" — needs partner review |
| `transfer` | Own-account transfer |
| `offset` | Refund paired with original purchase |

**Other per-household tables:** `merchant_knowledge`, `guesses` (bets), `account_aliases`, `category_overrides`, `category_budgets`.

### Default Categories

12 built-in: Food & Groceries, Transport, Streaming, Dining, Leisure, Health, Connectivity, Clothing, Kids & Toys, Home, Misc, Own Transfers — merged with household overrides via `useCategoryConfig()`.

---

## 13. API Surface

### Supabase Auth

`signUp`, `signInWithPassword`, `signOut`, `resetPasswordForEmail`, `updateUser`, `getSession`, `refreshSession`, `onAuthStateChange`.

### Supabase RPC Functions (~50+)

All household data access via SECURITY DEFINER functions with membership check.

**Profile & Household:** `get_my_profile`, `create_household`, `join_household_by_code`, `get_household_info`, `set_household_income`, `get_household_income`.

**Transactions:** `insert_transactions`, `get_pending_transactions`, `get_auto_classified_transactions`, `get_flagged_transactions`, `get_flagged_transactions_count`, `classify_transaction`, `confirm_auto_classified`, `reject_auto_classified`, `flag_transaction`, `mark_as_transfer`, `reclassify_transaction`, `revert_to_pending`, `set_transactions_user_note`, `detect_and_offset_refunds`, `sync_billing_month_from_tx_date`, `auto_mark_debit_loads`.

**Merchant Learning:** `learn_merchant`, `auto_classify_transactions`.

**Reveal & Stats:** `get_monthly_summary`, `get_monthly_totals`, `get_month_classification_stats`, `get_transactions_by_category`, `get_classified_transactions_export`, `get_transactions_classified_in_date_range`, `get_classified_counts_for_account`, `get_spending_by_account`, `get_card_funding_summary`, `get_salary_in_summary`.

**Gamification:** `award_xp`, `get_household_leaderboard`, `get_daily_activity_summary`, `get_daily_classification_counts`, `get_household_member_daily_records`.

**Bets:** `submit_bets`, `get_my_bets`, `get_household_bets`, `get_household_bet_status`.

**Accounts & Categories:** `get_account_aliases`, `upsert_account_alias`, `delete_account_alias`, `set_account_type`, `get_distinct_account_last4_for_month`, `get_distinct_account_last4_for_household`, `get_category_overrides`, `upsert_category_override`, `rename_category`, `delete_category`, `count_transactions_for_category`, `sample_transactions_for_category`, `get_category_budgets`, `upsert_category_budget`, `delete_category_budget`, `set_transfer_kind`.

### HTTP Endpoint

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/search?q=&count=` | GET | Brave Search proxy for merchant identification |

---

## 14. Authentication & Authorization

### Authentication

- **Supabase Auth** — email/password provider.
- JWT stored in browser; `autoRefreshToken: true`, `persistSession: true`.
- `detectSessionInUrl: false` for PWA safety — reset-password manually parses URL hash tokens.
- Session refresh on tab resume; periodic health check every 5 minutes.
- Orphan-session detection after DB resets.

### Authorization Model

1. **RLS on `profiles`** — users can only read/update/insert their own row.
2. **Household membership** — enforced in every RPC via `_resolve_household_schema`: resolves schema name, verifies `profiles.household_id` matches `auth.uid()`.
3. **No direct client access** to per-household tables — all via RPC.
4. **SECURITY DEFINER** functions run with elevated privileges but check membership first.

### Route Protection

`AuthGuard` component:
- Unauthenticated → `/login`.
- Authenticated but no household → `/household` (when `requireHousehold=true`).
- Loading states with boot stages: init → session → profile (progress bar).

---

## 15. Configuration & Setup

### Environment Variables

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
BRAVE_SEARCH_KEY=your-brave-api-key-here  # server-side only
```

### Local Development

```bash
cp .env.example .env   # fill Supabase + Brave keys
npm install
npm run dev             # http://localhost:5173
```

### Supabase Setup

1. Create Supabase project.
2. Run migrations in SQL Editor — in order: `migration.sql` (base), then `migration_002` through `migration_029`.
3. Enable Email auth provider.

### npm Scripts

| Script | Purpose |
|--------|---------|
| `dev` | Vite dev server |
| `build` | `tsc -b && vite build` |
| `lint` / `lint:ci` | ESLint |
| `preview` | Preview production build |

---

## 16. Directory Structure

```
SpentWhatt/
├── api/
│   └── search.ts                    # Vercel Brave Search proxy
├── supabase/
│   ├── migration.sql                # Base schema + core RPCs
│   ├── migration_002..029.sql       # Incremental features
│   ├── reset_*.sql                  # Maintenance scripts
│   └── backfill_xp.sql
├── src/
│   ├── main.tsx                     # React entry
│   ├── index.css                    # Tailwind + design tokens
│   ├── app/
│   │   ├── App.tsx                  # AuthProvider + RouterProvider
│   │   └── router.tsx               # Route definitions
│   ├── components/
│   │   ├── auth/                    # Login, signup, household, password
│   │   ├── home/                    # HomePage, HouseholdPodium
│   │   ├── upload/                  # CSV upload wizard
│   │   ├── swipe/                   # Classify deck (core UX)
│   │   ├── reveal/                  # Monthly reveal + charts
│   │   ├── bets/                    # Prediction game
│   │   ├── analysis/                # Financial health dashboard (~25 files)
│   │   ├── settings/                # CategoryEditorModal
│   │   ├── layout/                  # AppShell, tab bar, PWA install, backdrop
│   │   ├── common/                  # Buttons, pickers, modals, scroll report
│   │   └── dev/                     # Animation test page
│   ├── hooks/                       # useAuth, useTransactions, useReveal, etc.
│   ├── stores/
│   │   └── classificationStore.ts   # Zustand deck state
│   ├── lib/                         # Constants, CSV parsing, exports, insights
│   └── types/
│       └── database.ts              # TypeScript interfaces
├── vite.config.ts                   # Vite + PWA + Tailwind + dev proxy
├── package.json
├── SUPABASE_SETUP.md
└── .env.example
```

---

## 17. Testing

### Setup

**Vitest 4** is the test runner, configured in `vitest.config.ts`:

| Option | Value |
|--------|-------|
| `environment` | `jsdom` (DOM APIs for future component tests) |
| `globals` | `true` — `describe`, `it`, `expect` available without imports |
| `setupFiles` | `./src/test/setup.ts` |
| `include` | `src/**/*.test.{ts,tsx}` |

The setup file (`src/test/setup.ts`) registers `@testing-library/jest-dom/vitest`, making DOM matchers like `toBeInTheDocument()` available. `@testing-library/react` and `@testing-library/user-event` are used for component tests.

### Running Tests

| Script | Command | Mode |
|--------|---------|------|
| `npm test` | `vitest run` | Single run, exits with non-zero on failure |
| `npm run test:watch` | `vitest` | Watch mode — re-runs on file save |

Expected output on success:

```
Test Files  11 passed (11)
     Tests  98 passed (98)
  Duration  ~8s
```

Each failing test prints the assertion diff; the run exits with code 1.

### Test File Inventory

| Test file | Source module | Tests |
|-----------|---------------|------:|
| `src/lib/csvColumnMap.test.ts` | `csvColumnMap.ts` — header normalization, synonym matching, column auto-detection | 14 |
| `src/lib/xpLevels.test.ts` | `xpLevels.ts` — level thresholds, progress, titles | 20 |
| `src/lib/recurringDetector.test.ts` | `recurringDetector.ts` — recurring charge heuristics | 7 |
| `src/stores/classificationStore.test.ts` | `classificationStore.ts` — Zustand deck grouping, advance, undo | 13 |
| `src/hooks/useMultiMonthReveal.test.ts` | `buildDailyTotals()` in `useMultiMonthReveal.ts` — daily spend aggregation | 6 |
| `src/components/auth/LoginPage.test.tsx` | `LoginPage.tsx` — form rendering, sign-in flow, error display, session expired/password reset banners | 7 |
| `src/components/auth/SignUpPage.test.tsx` | `SignUpPage.tsx` — form rendering, sign-up flow, email confirmation, error display | 7 |
| `src/components/bets/BetsPage.test.tsx` | `BetsPage.tsx` — bet category rendering, submit flow, error banner, disabled state | 6 |
| `src/components/upload/UploadPage.test.tsx` | `UploadPage.tsx` — page rendering, CSV parse, column detection | 5 |
| `src/components/swipe/SwipeDeck.test.tsx` | `SwipeDeck.tsx` — empty deck state, upload link, render smoke tests | 4 |
| `src/components/reveal/RevealPage.test.tsx` | `RevealPage.tsx` — celebration screen, income editor, blocked/no-data states, month selector | 8 |
| **Total** | | **98** |

### Writing New Tests

- **File naming:** `*.test.ts` (or `.tsx`) alongside the source file under `src/`.
- **Pattern:** AAA (Arrange / Act / Assert) with inline comments marking each phase — see existing tests for examples.
- **Priority:** Pure logic first — functions with no Supabase or React dependencies need no mocking. Component tests mock hooks via `vi.mock()`.
- **Imports:** Explicit `import { describe, it, expect } from 'vitest'` (globals are enabled but imports are used consistently).
- **Store tests:** Call `useClassificationStore.getState()` directly; reset in `beforeEach`.
- **Component tests:** Use `MockAuthProvider` from `src/test/mock-auth.tsx` and `MockRouter` from `src/test/mock-router.tsx`. Mock hooks like `useBets`, `useReveal`, `useTransactions` etc. via `vi.mock()`.
- **CI enforcement:** `.github/workflows/ci.yml` runs `npm test` on every push/PR to main.
- **Setup helpers:** Factory functions like `makeTx()` at the top of each file keep fixtures readable.

### Coverage Areas

**Covered (pure logic, no mocks):**

- CSV column mapping and header synonym detection
- XP level calculation and progress
- Recurring charge detection (CV, tier splitting, exclusions)
- Classification store grouping, predicted category, session XP, rollback
- Daily totals aggregation for analysis heatmap

**Not covered yet:**

- React component rendering (`@testing-library/react`)
- Hook integration tests with mocked Supabase client
- Upload amount/date parsing (lives inline in `UploadPage.tsx`)
- Advisor insights rule engine (`advisorInsights.ts`)
- End-to-end / browser tests

---

## 18. Recommendations & Known Issues

### Security Vulnerabilities

| Severity | Issue | Detail | Status |
|----------|-------|--------|--------|
| **Critical** | **`profiles` RLS allows `household_id` and `total_xp` tampering** | The `profiles_update_own` policy allows updating _any_ column on the user's own row. A user can call PostgREST directly to set `household_id` to any UUID (bypassing invite flow) or inflate `total_xp`. Since `_resolve_household_schema` trusts `profiles.household_id`, this grants access to another household's data. Fix: column-level privileges or a trigger restricting direct updates to `ui_prefs` and `display_name` only. | **Fixed in v1.2.0** — `migration_030` replaces policy with `profiles_update_safe_columns` (WITH CHECK prevents `household_id` / `total_xp` changes). |
| **High** | **`award_xp` has no authorization** | Any authenticated user can add XP to _any_ `p_user_id` — no `auth.uid()` check, no household membership check. Fix: require `p_user_id = auth.uid()` or move XP grants inside the classify RPCs. | **Fixed in v1.2.0** — `migration_030` adds `auth.uid()` check; client `awardXp` no longer passes `user.id`. |
| **High** | **`/api/search` is unauthenticated** | The Brave Search proxy accepts anonymous GET requests. No JWT check, no rate limit — anyone can abuse the API key. Fix: require Supabase JWT in the request header. | **Fixed in v1.2.0** — `api/search.ts` requires `Authorization: Bearer` header and validates JWT via Supabase. Client sends session token. |
| **Medium** | **`p_classified_by` not bound to `auth.uid()`** | Callers can attribute classifications to another household member. | **Fixed in v1.2.0** — `migration_030` binds `classified_by := auth.uid()` in `classify_transaction`, `confirm_auto_classified`, `reclassify_transaction`, `mark_as_transfer`. Client no longer passes `user.id`. |
| **Medium** | **Invite code brute-force** | 6 chars (~1B combinations) with no lockout or per-user rate limiting on `join_household_by_code`. | Open |
| **Medium** | **`uploaded_by` is client-supplied** | `insert_transactions` trusts `elem->>'uploaded_by'` from the JSON payload rather than enforcing `auth.uid()`. | **Fixed in v1.2.0** — `migration_030` uses `auth.uid()` for `uploaded_by`; client no longer sends the field. |

### Race Conditions & Data Integrity

| Severity | Issue | Detail |
|----------|-------|--------|
| **High** | **No concurrent deck sync** | Presence shows who's online but there's no `postgres_changes` subscription, no polling, and no realtime transaction sync. Two members can classify the same transaction — last writer wins with no conflict message, and both earn XP. |
| **High** | **`classify_transaction` has no status guard** | The RPC updates _any_ transaction by ID regardless of current status — already-classified, flagged, transfer, or offset rows can be silently overwritten. Fix: add `WHERE status IN ('pending', 'auto', 'flagged')` + check `ROW_COUNT`. | **Fixed in v1.2.0** — `migration_030` adds `WHERE status IN ('pending', 'auto', 'flagged')` + raises on 0 rows. |
| **Medium** | **Double XP for same transaction** | XP is awarded client-side after classify with no server-side idempotency. Two members classifying the same tx both call `award_xp`. |
| **Medium** | **Partial group failure leaves split state** | `runGroupRpc` classifies transactions sequentially; on failure mid-stack, earlier txs are already classified on the server but the entire group is re-injected locally as if unclassified. |
| **Medium** | **Auto-confirm swallows RPC errors** | `confirmAutoClassified` always returns `{ error: null }` to `runGroupRpc`. If the server fails or the tx was already classified by a partner, the UI still advances and awards XP. |

### Bugs

| Issue | Impact | Detail |
|-------|--------|--------|
| **Deck-cleared XP display incorrect** | Low (cosmetic) | `DeckClearedScreen` calculates `classifiedTxCount × CLASSIFY_MANUAL` (10 XP) for all transactions, but auto-confirms only award 5 XP each. Overstates earned XP on the completion screen. |
| **Undo does not deduct XP** | Low (gamification integrity) | `revert_to_pending` reverts the transaction but no negative XP is awarded. Users keep XP after undoing. |
| **Bets submit ignores errors** | Medium | `BetsPage.handleSubmit` always shows success + confetti regardless of whether the RPC succeeded. |
| **PWA theme color mismatch** | Low (cosmetic) | Manifest `theme_color: '#6366f1'` (indigo) vs `index.html` `theme-color: '#0f172a'` (dark slate). |
| **PWA navbar fix not applied** | Low | `PWA_NAVBAR_DEBUG.md` marks Attempt 7 as SUCCESS, but the fix is not in `index.css`. Doc may be ahead of commits or the fix was reverted. |

### Missing Basic UI/UX

These are standard patterns that most users would expect but are currently absent.

**Onboarding & Guidance:**

| Gap | Detail |
|-----|--------|
| **No first-run classify tutorial** | Swipe hints exist as footer text on cards ("Swipe right to categorize · left to flag") and drag overlays, but there is no coach-mark overlay, gesture animation demo, or dismiss-once tutorial for new users. Easy to miss on mobile. |
| **No about / help page** | No in-app documentation, FAQ, or feature walkthrough. |
| **No terms / privacy / contact** | No legal pages or support link. |
| **No changelog / what's new** | Version string on Home footer only; no release notes. |

**Profile & Account Management:**

| Gap | Detail |
|-----|--------|
| **No profile / settings page** | No dedicated settings screen. Home shows XP + sign out + version only. |
| **Can't change display name** | Set only at signup via Supabase metadata; no editor. |
| **Can't change email or password** (in-app) | Only the forgot/reset flow via email exists. |
| **Can't leave or switch household** | No RPC or UI for this. |
| **Can't edit household name** | Display only on Home. |
| **No sign-out confirmation** | Tapping sign out is immediate with no dialog. |

**Transaction Management:**

| Gap | Detail |
|-----|--------|
| **Can't delete uploaded transactions** | No delete-transaction RPC or UI. Bad uploads are permanent. |
| **Can't edit transaction fields** | Amount, date, and merchant are immutable after upload. Classify allows category, transfer, flag, and notes only. |
| **No global transaction browser** | Users can only see pending (classify deck), recent (7-day Recent panel), or per-category (Reveal drill-down). No searchable, filterable "all transactions" view. |
| **No bulk classify / multi-select** | One stack at a time. |
| **Account alias delete has no UI** | `deleteAccountAlias` RPC and hook exist; no button calls them. |

**Form UX:**

| Gap | Detail |
|-----|--------|
| **No password visibility toggle** | All auth password inputs are `type="password"` with no show/hide eye icon — common mobile expectation. |
| **No auto-focus on auth forms** | User must tap the first field. |
| **No password strength indicator** | Minimum length (6) only; no visual feedback. |

**Navigation & Empty States:**

| Gap | Detail |
|-----|--------|
| ~~**Upload not in tab bar**~~ | ✅ *Fixed v1.6.0* — Upload is now a 6th tab in the persistent tab bar. |
| ~~**Home has no loading state**~~ | ✅ *Fixed v1.6.0* — Skeleton placeholder shown while household data loads. |
| ~~**Analysis empty state has no upload link**~~ | ✅ *Fixed v1.6.0* — "Upload a statement" CTA added to the empty state. |
| **No skeleton loaders anywhere** | Partially addressed in v1.6.0 (Home page). Other pages still use spinners. |

**Visual & Interaction Feedback:**

| Gap | Detail |
|-----|--------|
| **No haptic feedback on swipe** | No `navigator.vibrate()` on classify gestures — common in swipe-heavy mobile UX. |
| **No sound effects** | Silent app throughout. |
| **Note save failure is silent** | `handleSaveNote` returns on error with no toast or feedback. |
| **Category/alias save confirmation is silent** | Modal closes with no success toast after saving. |

**Internationalization & Currency:**

| Gap | Detail |
|-----|--------|
| **EUR hard-coded** | `currency: 'EUR'` is used everywhere for formatting. CSV parser strips symbols but always displays EUR. |
| **English only** | All copy is English; no `i18n` framework or language selector. Upload column detection supports EN/ES/CA headers, but UI text is fixed. |
| **No dark / light mode toggle** | Dark theme is permanent. |

**Edge Cases:**

| Gap | Detail |
|-----|--------|
| **Long merchant names can overflow** | The `h2` on swipe cards has no `truncate` or `line-clamp` — long bank descriptions can wrap awkwardly. |
| **Large CSV files** | Full file read into memory via `FileReader` — no size warning, row cap, or chunked upload. |
| **Category merge** | No UI to merge two categories. `rename_category` RPC can change the ID but that's a rename, not a merge. |
| **Category reorder** | `sort_order` field exists in the `upsertCategory` API but the category grid uses a static order. |

### Dead Code to Clean Up

| Item | Location |
|------|----------|
| ~~`reject_auto_classified`~~ | ✅ *Fixed v1.4.0* — now wired to left-swipe on auto-classified cards. |
| ~~`useStandalonePwa`~~| ✅ *Removed v1.6.0* — file deleted; standalone detection remains inline in `InstallPrompt.tsx`. |
| ~~`inferTransferKind`~~ | ✅ *Removed v1.6.0* — `src/lib/transferKind.ts` deleted. |
| `set_transfer_kind` RPC | Migration grants it, no client call |
| ~~`XP_VALUES.FIRST_STRIKE_PER_AUTO`, `STREAK_MULTIPLIER`~~ | ✅ *Removed v1.6.0* — pruned from `constants.ts`. |
| ~~`Guess` interface~~ | ✅ *Removed v1.6.0* — pruned from `database.ts`. |
| ~~Deprecated `CATEGORIES` fallbacks~~ | ✅ *Removed v1.6.0* — `CATEGORIES` alias deleted; `categories` is now a required prop in `SwipeCard` and `CategoryDetail`. |

### Silent Error Handling

Many RPC failures are swallowed with `console.warn` / `console.error` or simply return empty results without user feedback. High-priority areas:

- `awardXp` — return value ignored in SwipeDeck.
- `learnMerchant` — fire-and-forget, no error check.
- `handleSaveNote` — `if (error) return` with no toast.
- `AnalysisPage` — destructures `{ data, loading, fetch }` but never reads or displays `error`.
- `HomePage` parallel fetches — failures yield empty sections silently.
- `BetsPage.handleSubmit` — always shows success regardless of RPC outcome.
- `RevealPage.saveAlias` — `console.error` only on failure.
- `useUiPrefs.updatePrefs` — no error handling or rollback on failed write.
- `getTransactionsByCategory` — returns `[]` on error; drill-down shows empty list.

### No Automated Tests

Zero test files exist. No `vitest`, `jest`, or test scripts in `package.json`. High-value candidates for a first test suite:

- CSV parsing and column detection (`csvColumnMap.ts`, upload amount/date parsing).
- Advisor insights rule engine (`advisorInsights.ts`).
- Classification store grouping logic (`classificationStore.ts`).
- XP level progression (`xpLevels.ts`).
- Recurring charge detection (`recurringDetector.ts`).

### No CI/CD or Observability

| Gap | Detail |
|-----|--------|
| ~~**No CI/CD pipeline**~~ | **Fixed v1.7.0** — `.github/workflows/ci.yml` runs lint, test, and build on push/PR to main. |
| **No error tracking** | No Sentry, LogRocket, or equivalent. Production errors are invisible. (Deferred — requires external project setup.) |
| **No health checks** | No `/health` endpoint or uptime probe. |
| **No product analytics** | No PostHog, GA, Amplitude, or equivalent. |
| ~~**Lint not enforced**~~ | **Fixed v1.7.0** — CI workflow enforces lint on every push. |

### Migration Risks

| Severity | Issue | Detail |
|----------|-------|--------|
| **High** | **Manual, ordered chain** | 29 migrations must be applied in sequence via SQL Editor. No migration version table; easy to skip or misorder. |
| **High** | **`migration_007` is destructive** | Deletes duplicate transactions and resets all XP to 0. Not safe to re-run. |
| **Medium** | **Mixed idempotency** | `CREATE OR REPLACE FUNCTION` and `ADD COLUMN IF NOT EXISTS` are safe. Data-mutating `DO` blocks are not. |

### Performance

| Concern | Detail |
|---------|--------|
| **N+1 RPC fan-out** | `useMultiMonthReveal` fires 2N+5 parallel RPCs for N months. A batch RPC returning all months would reduce round-trips. |
| **Per-tx RPC in classify** | `runGroupRpc` loops one RPC per transaction in a stack. A batch classify RPC would improve large-stack performance. |
| **Duplicate font load** | Inter loaded via both `@import` in `index.css` and `<link>` in `index.html`. |
| **Heavy main bundle** | `framer-motion`, `recharts`, `animejs` all in main path. PDF/PPTX use dynamic `import()` (good). |

### Accessibility

| Issue | Detail |
|-------|--------|
| **Pinch-zoom blocked** | `index.html` sets `maximum-scale=1.0, user-scalable=no` — WCAG failure. |
| **No `prefers-reduced-motion`** | Confetti, Framer Motion animations, blob CSS run unconditionally. |
| **CategoryPicker portal** | Missing `role="dialog"`, `aria-modal`, focus trap. |
| **Small touch targets** | Tab bar labels at `text-[10px]`. |
| **Color-only status indicators** | Flame/gem/green indicators in several places without non-color cues. |

### Large Files

The workspace rules target files under 300 lines. Several core files significantly exceed this:

| File | Lines |
|------|-------|
| `SwipeDeck.tsx` | ~2148 |
| `generateDashboardPdf.ts` | ~1466 |
| `generateSlideDeck.ts` | ~954 |
| `RevealPage.tsx` | ~902 |
| `UploadPage.tsx` | ~870 |
| `advisorInsights.ts` | ~646 |

`SwipeDeck.tsx` is the highest-priority refactor candidate — deck logic, recent panel, modals, and effects could be extracted into focused modules.

### Recommended Priority Order

**Tier 1 — Security (fix before sharing widely):** ✅ Completed in v1.2.0

1. ~~Lock down `profiles` RLS — column-level privileges or trigger restricting direct updates to `ui_prefs` and `display_name` only; route `household_id` and `total_xp` changes through SECURITY DEFINER RPCs.~~ Done.
2. ~~Harden `award_xp` — require `p_user_id = auth.uid()` or move XP grants inside classify RPCs (idempotent, server-side).~~ Done.
3. ~~Protect `/api/search` — require Supabase JWT in the request header; add rate limiting.~~ Done (JWT required; rate limiting not yet added).
4. ~~Bind `p_classified_by` to `auth.uid()` inside classify RPCs.~~ Done.
5. ~~Add `WHERE status IN ('pending', 'auto', 'flagged')` guard to `classify_transaction` + verify `ROW_COUNT`.~~ Done.

**Tier 2 — Bug fixes, error handling & test foundation:** ✅ Completed in v1.3.0

6. ~~Fix deck-cleared XP display — tracked `sessionXpEarned` in store instead of incorrect `classifiedTxCount * CLASSIFY_MANUAL` calculation.~~ Done.
7. ~~BetsPage error handling — `submitBets` now checks returned error and shows banner instead of always firing confetti.~~ Done.
8. ~~AnalysisPage error display — `useMultiMonthReveal` error is now destructured and rendered as banner.~~ Done.
9. ~~Theme-color mismatch — `index.html` meta tag aligned with PWA manifest (`#6366f1`).~~ Done.
10. ~~Duplicate font link — removed Google Fonts `<link>` from `index.html` (CSS `@import` is the single source).~~ Done.
11. ~~Vitest test foundation — config, setup, 5 pure-logic test files (59 tests): `csvColumnMap`, `xpLevels`, `recurringDetector`, `classificationStore`, `buildDailyTotals`.~~ Done.

**Tier 3 — Data integrity & concurrent use:** ✅ Completed in v1.4.0

12. ~~Concurrent classify sync — 30-second polling + visibility-change refetch keeps the deck in sync across household members.~~ Done.
13. ~~Batch classify RPCs — `classify_transactions_batch`, `confirm_auto_classified_batch`, `flag_transactions_batch`, `mark_as_transfer_batch`, `revert_to_pending_batch`, `reclassify_transactions_batch`. Eliminates per-tx loops and partial-failure split state.~~ Done.
14. ~~Fix auto-confirm error swallowing — `confirmAutoClassified` now returns `{ error }` and is checked by `runBatchRpc`.~~ Done.
14b. ~~Wire `rejectAutoClassified` — swipe-left on predicted cards now rejects the auto-classification instead of flagging.~~ Done.
14c. ~~XP undo on revert — `SessionAction` tracks `xpEarned`; rollback deducts from `sessionXpEarned` and calls negative `awardXp` (server-side `GREATEST(0, total_xp + p_xp)` floor guard).~~ Done.

**Tier 4 — Auth UX & Profile Management:** ✅ Completed in v1.5.0

15. ~~Profile / settings page — SettingsPage with display name, password, household name, leave household, sign-out with confirmations.~~ Done.
16. ~~Password visibility toggle on all auth forms — shared `PasswordInput` component with eye icon.~~ Done.
17. ~~Auto-focus on first input of each auth form.~~ Done.
18. ~~Sign-out confirmation dialog — moved from HomePage to SettingsPage with confirmation step.~~ Done.
19. ~~Migration `032_profile_management.sql` — `update_display_name`, `update_household_name`, `leave_household` RPCs.~~ Done.

**Tier 5 — Missing basics (remaining UX impact):**

20. Transaction delete capability — at minimum "delete upload batch".
21. First-run classify tutorial — dismiss-once coach overlay with gesture demo.
22. ~~Upload accessible from tab bar or persistent FAB.~~ ✅ v1.6.0
23. ~~Home loading states (skeleton or spinner for activity/leaderboard).~~ ✅ v1.6.0

**Tier 5 — Polish & infrastructure:**

22. ~~CI/CD pipeline — GitHub Action for lint + build.~~ ✅ v1.7.0
23. Error tracking — Sentry or equivalent on frontend + serverless. (Deferred — requires external project setup.)
24. ~~Wire `rejectAutoClassified` — swipe-left on predicted cards.~~ ✅ v1.4.0
25. ~~Undo XP clawback on revert-to-pending.~~ ✅ v1.4.0
26. Haptic feedback on swipe gestures.
27. ~~Skeleton loaders for major views.~~ ✅ v1.6.0
28. Transfer kind UI (salary vs card funding vs internal).
29. Category merge and reorder.
30. Batch multi-month RPC for analysis.
31. Generated Supabase types for RPC type safety.
32. ~~Gate `/dev/animations` behind `import.meta.env.DEV`.~~ Done in v1.2.0.
