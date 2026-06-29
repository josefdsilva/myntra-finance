# Household Budget & Planner

A shared financial planning tool for your household (you, partner, 2 kids). Both adults log in and see the same budget, expenses, and allocations.

## Core features (v1)

1. **Auth & household**
   - Email/password + Google sign-in
   - Each user belongs to one household; both partners share all data
   - Invite partner by email after creating the household

2. **Daily "safe to spend" dashboard**
   - Big number: how much you can still spend today without exceeding the monthly baseline
   - Formula: `(baseline_budget − variable_spent_this_month) ÷ days_remaining`
   - Month progress bar + breakdown of spent vs remaining
   - Recent expenses feed

3. **Settings (household-level)**
   - Monthly income (per adult, summed)
   - Monthly baseline budget (fixed expenses + groceries + safety margin %)
   - Fixed expenses list (rent, loans, subscriptions, utilities) with name + amount
   - Allocation buckets — fully configurable: name, target type (`% of surplus` or `fixed €/month` or `fixed €/year`), value
     - Defaults to get started: Long-term investments, Emergency savings, Kids savings, Life projects
     - Slider UI for percentages; auto-validates that % buckets sum to ≤100%
   - Currency: EUR (locked)
   - Date format: DD/MM/YYYY HH:mm:ss

4. **Allocation view**
   - Surplus = income − baseline
   - Shows how much goes to each bucket this month
   - Year-to-date totals per bucket
   - Editable any time; recomputes instantly

5. **Add expenses — multiple ways**
   - **Manual**: amount, category, date, note
   - **AI text/voice memo**: type or record "spent 42€ on groceries at Lidl yesterday" → AI parses {amount, category, merchant, date} → you confirm → saved. Voice uses browser MediaRecorder + speech-to-text, then same parser.
   - **Bank statement import**: upload CSV or PDF → AI extracts transactions, categorizes them, you review and approve in bulk

6. **History & filters**
   - All expenses list with date, amount, category, who added it, source (manual/AI/import)
   - Filter by month, category, person
   - Edit/delete

## Technical details

**Stack**: TanStack Start + Lovable Cloud (Postgres + auth + storage) + Lovable AI Gateway (Gemini for parsing memos, receipts, statements; speech-to-text for voice).

**Database (Lovable Cloud)**:
- `households` — id, name, baseline_budget, margin_pct, created_at
- `household_members` — household_id, user_id, role (owner/member) — gates RLS
- `profiles` — user_id, display_name, household_id
- `incomes` — household_id, owner_user_id, label, monthly_amount
- `fixed_expenses` — household_id, label, monthly_amount, category
- `buckets` — household_id, name, target_type (`pct_surplus`|`fixed_monthly`|`fixed_yearly`), target_value, sort_order
- `expenses` — household_id, added_by_user_id, amount, category, occurred_at, note, source (`manual`|`ai_memo`|`ai_voice`|`statement`), source_meta jsonb
- `bank_imports` — household_id, uploaded_by, file_name, status, raw_extract jsonb
- RLS: every table scoped via `household_members` (security-definer helper `is_member(household_id)`)

**AI** (via Lovable AI Gateway, server functions only):
- Memo/voice parser: `google/gemini-3-flash-preview` with structured output → {amount, category, merchant, occurred_at, note}
- Statement parser: same model, multimodal (PDF/CSV upload) → array of transactions
- Voice transcription: `openai/gpt-4o-mini-transcribe`

**Routes**:
- `/auth` — sign in / sign up (public)
- `/_authenticated/` (protected layout)
  - `/` — daily dashboard
  - `/expenses` — history + add
  - `/allocations` — buckets and surplus view
  - `/settings` — income, fixed expenses, buckets, baseline, household & invites

## v1 scope boundaries

- No receipt-photo OCR yet (you didn't pick it); easy to add later
- No multi-currency
- No investment account integrations — buckets are budgeting targets, not brokerage links
- No automatic recurring-transaction detection from statements beyond AI categorization
- No mobile native app — responsive web (works great on phone)

## What I'll do first

1. Enable Lovable Cloud (database + auth + storage)
2. Set up the schema + RLS + auth (email + Google)
3. Build the design system (calm, financial-app feel — not generic SaaS purple)
4. Implement settings, then dashboard, then expense capture, then allocations
5. Wire up AI parsing last (once data flows work end-to-end)

Approve and I'll start with Cloud enablement and the schema.
