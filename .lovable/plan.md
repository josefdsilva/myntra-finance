# Make bynku engaging in the first 10 minutes

The signal that matters most: volunteer testers aren't coming back. That isn't a missing
feature — it's that bynku asks for a lot of setup before it gives anything back, and once
you're in there are 16 places to go and no single thing telling you what to do next.

So this plan is deliberately narrow: **give value before setup is finished, then give one
next action and visible proof it worked.** Households and families only.

## The three moves

### 1. Value before setup ("first value in 60 seconds")

Today a tester must complete onboarding, then land on a dashboard of empty cards. Instead,
the very first screen after sign-up asks for two numbers only — monthly money in, and rough
monthly essentials — and immediately shows a real result: what's left each month, how many
months of safety net that buys, and one thing to change. Everything else (projects, loans,
categories, assets) becomes optional and prompted later, in context.

Anything still unknown shows as a soft, tappable gap ("add your loans to make this exact")
rather than a blocker or an empty state.

### 2. One next action, everywhere

Insight is currently spread across dashboard tips, the coach dock, the coach inbox, the
setup checklist, and the journey page — five voices, no priority. Consolidate into a single
prioritised "Do this next" card at the top of the dashboard:

- one action at a time, drawn from the existing tip/coach/journey signals through one
  ranking function
- plain sentence: what to do, why it matters, what it's worth
- a button that goes straight to the screen where it's done, prefilled
- when done, it confirms and reveals the next one

The other surfaces stay, but stop competing for the top of the page.

### 3. Proof that it worked

Engagement needs a number that visibly moves. Add a "since you started" strip: what's
changed in what's left, safety-net months, and total owed since the first cycle — plus the
persisted medals already designed in the journey work, so recognition survives edits.

Where the headline number would be wrong without owned things (a mortgage showing with no
house behind it), show equity honestly and prompt to add the house rather than printing a
misleading net worth.

### Plus: fewer words, less jargon

Apply the locked plain-language decisions to the surfaces above only — "what's left", "set
aside", "projects", "how much do I need" — and put a one-tap explanation next to every
number those screens show. No renaming spree elsewhere in this pass.

### Nav slimming

16 sidebar entries is more than a new user can hold. Group the analysis/simulation screens
(Analysis, Fast Forward, Cycle report, Snapshot) behind one "Insights" entry, and move
Capture, Privacy and Wiki out of the primary list. No routes are deleted or moved — only
how they're grouped in the sidebar.

## Technical notes

- New `src/components/next-action.tsx` plus `src/lib/next-action.ts`: a pure ranking
  function that takes the signals `dashboard-tips.tsx`, `coach-signals.ts`,
  `setup-checklist.tsx` and `journey.functions.ts` already produce and returns one ranked
  action. No new financial maths — it reads existing engines only.
- Reduce `dashboard-tips.tsx` (953 lines) to a "more tips" section below the fold; its rule
  set is reused as an input to the ranking function.
- New minimal first-run route (or a short-circuit at the top of the existing
  `onboarding.tsx` flow) that collects income + essentials, writes them through the existing
  income/fixed-expense server fns, and routes to the dashboard. The full wizard stays
  reachable for anyone who wants it.
- "Since you started" reads existing `cycle_metrics` snapshots and the first-cycle row —
  no migration.
- Persisted achievements: reuse `achievements.functions.ts` and the Phase 0 work already
  described in `docs/money-journey-plan.md`.
- Nav grouping is presentation-only inside `app-shell.tsx`.
- i18n keys added for all five locales.
- Also fix the current SSR hydration mismatch in `app-shell.tsx` while touching that file.

## What this plan deliberately does not do

Forwarding inbox / bank-alert capture, real estate indices, encryption, streaks, store
wrap, SME work. All defensible later — none of them fix "testers don't come back".

## How we'll know it worked

A tester who signs up sees a real number about their own money before they finish setup,
has exactly one thing to do next on every visit, and can see what changed since last time.
That's the bar to judge this against.
