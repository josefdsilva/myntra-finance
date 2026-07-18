# Next batch: retention, smarter coach, shareable snapshot

Three tracks based on the earlier suggestions you approved: **(1) Trust & retention**, **(5) AI coach cost/value**, **(7) Shareable snapshot**. Delivered in that order so each ships independently.

---

## Track 1 — Trust & retention

### 1a. Guided onboarding tour (post beta-code)
A 3-step overlay that runs once after a new user redeems a code and lands on the dashboard. Uses existing routes, no new tables.

Steps:
1. **Add your income** → highlights "Money In" nav, CTA opens the page.
2. **Add your fixed costs & loans** → highlights Settings > Fixed expenses / Loans.
3. **Create your first project (bucket)** → highlights Allocations / Plans.

Progress persisted in `localStorage` (`bynku:onboarding:v1`) + a "Skip tour" option. Fully localized (EN/PT/ES/DE/FR).

### 1b. Contextual empty states
Currently Dashboard / Plans / Loans / Allocations show empty cards silently when nothing is configured. Replace with friendly empty-state components:
- Icon + one-line explanation of *why* this screen matters
- Primary CTA that jumps to the right setup screen
- Uses existing `dashboard-tips` tone so it feels consistent

### 1c. Weekly digest email (activate the scaffolded webhook)
The route `src/routes/api/public/hooks/weekly-digest.ts` already exists but isn't wired to a proper template. Deliverable:
- React Email template `src/lib/email-templates/weekly-digest.tsx` — surplus this week, top spending category, one tip pulled from `dashboard-tips` logic
- Send once per week per household to the owner's email (opt-in via existing `notification_prefs`)
- pg_cron entry that hits the public webhook every Monday 08:00 in household timezone (fallback UTC)

---

## Track 5 — Smarter, cheaper AI coach

### 5a. Proactive weekly insight
Once per week, a background job (same cron as digest) calls a lightweight server function that:
- Loads the household snapshot (surplus, top category, unusual spending vs benchmark)
- Generates 1 short coach message using `openai/gpt-5.5` with a strict 120-token cap
- Inserts it into `coach_messages` with `role='assistant'` and a new `kind='weekly_insight'` column so the dock shows a subtle "New from coach" indicator

Cost control: 1 call/household/week, capped at ~200 tokens total.

### 5b. Quick-answer tier
Split the coach into two paths in `src/lib/coach.functions.ts`:
- **Quick**: factual/UI questions (< ~30 tokens input, no household context needed). Uses `google/gemini-2.5-flash` with no history, no household payload. ~10× cheaper.
- **Deep** (current behavior): full context + memory window, used for advice.

Routing heuristic: if the user message matches a small regex/keyword set (what is, how do I, where is, explain) AND is < 200 chars → Quick. Otherwise Deep. Add a "Deep think" toggle in the coach dock to force Deep.

---

## Track 7 — Shareable financial health snapshot

A privacy-safe PNG the user can share on social — **no absolute numbers, only badges & relative scores**.

### What's on it
- Bynku logo + "My financial health"
- Overall health score (0–100), computed from:
  - Emergency fund ratio (fund / monthly fixed costs)
  - Debt-to-income ratio
  - Savings rate (surplus / income)
  - Budget adherence (spent vs estimate)
- 3–4 badges earned: `Emergency Ready`, `Debt Slayer`, `Budget Hero`, `Consistent Saver`, `Investing`
- Month label ("July 2026") — no €, no household name

### How it's rendered
- New route `/_authenticated/snapshot` shows a preview card + "Download PNG" / "Share" buttons
- Client-side rendering via `html-to-image` (already a small dep, or add it) — no server, no OG image needed
- Web Share API on mobile with fallback to download

### Where it's promoted
- Small "Share your progress" button on Dashboard when health score ≥ 60
- Dismissable

---

## Delivery order & rough scope
1. Empty states (small, quick win)
2. Onboarding tour
3. Snapshot page (self-contained, satisfying)
4. Weekly digest email (needs cron + template)
5. Quick/Deep coach split
6. Proactive weekly insight (needs same cron + new column)

## Technical notes
- One migration adds `coach_messages.kind text default 'chat'` and a `weekly_insights_sent` timestamp on `households`
- No schema changes for tracks 1a/1b/7
- Weekly digest cron uses the existing `project--{id}.lovable.app` stable URL calling the public webhook with a shared secret header
- All new user-facing strings added to the 5 locale files
- No new secrets required — reuses `LOVABLE_API_KEY` and email infra already set up
