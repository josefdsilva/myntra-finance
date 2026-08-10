# Making bynku easy for a 62-year-old first-time user

Grounded in one real tester (Portuguese, PT locale, wording itself is fine). She gets stuck in three
places: finding things in the menu, understanding the words and numbers, and adding an expense or
income. Plan only — nothing is built until you approve.

## 1. Finding things: one short menu

Today the sidebar exposes ~16 destinations at the same level (Dashboard, Journey, Money in & out,
Assets, Expenses, Save & Invest, Loans, Analysis, Fast forward, Cycle report, Snapshot, Wiki,
Households, Capture, Statements, Settings). For a new user every item is an equally plausible guess.

Proposal: five primary items, everything else behind one "More" group.

```text
Home            (dashboard)
Money in & out  (income, bills, everyday spending)
Save & Invest   (projects, goals)
Loans
More            Analysis · Fast forward · Cycle report · Snapshot · Journey · Assets ·
                Statements · Households · Help · Settings
```

- The five primary items are the daily loop; the rest are things you visit occasionally.
- No routes are removed or renamed — only how they are grouped in the sidebar.
- "More" starts collapsed, and auto-expands when the current route lives inside it, so she is never
  looking at a menu that doesn't contain the page she's on.

## 2. Understanding the words and numbers

Adopt the plain-language naming already agreed in `docs/plain-language-redesign.md`, but only the
cheap, low-risk half of it — the words, not an information-architecture reshuffle:

- baseline → "How much I need" (keep the breakdown: bills + loans + everyday + cushion)
- surplus / real surplus → "What's left"
- allocate / allocations → "set aside" / Save & Invest
- buckets → projects (finish the rename)
- safety margin → keep, but always with a one-line plain explanation
- avoid "owe/owed"; a borrowed-and-repaid thing is a Loan

Plus a small reusable "What's this?" control (an info button opening a short plain-Portuguese
explanation and a link to the matching wiki entry), attached to exactly the numbers she meets first:
How much I need, What's left, Safe to spend, and each project kind.

Every string goes through the existing i18n entries, so PT and the other locales stay in sync.

## 3. Adding an expense or income: short form first

The quick-add form currently presents amount, category, need-level (Essential→Treat), date, an
income/received toggle, note, and labels at once. Six of those are optional.

Proposal: the form opens with three fields only — **amount, category, date (prefilled today)** — and
a single "Add details" toggle that reveals need-level, note and labels. Saving with just the three
fields already works today; this only changes what is visible by default.

- Same for the money-in path: amount, source, date.
- Bigger tap targets and larger amount text on mobile, since that's the field she uses most.
- The photo and voice capture paths stay exactly as they are.

## 4. Reading the screen

A light accessibility pass over the screens above, not a redesign: minimum 44×44 tap targets on
primary buttons, no text below 14px in the daily-loop screens, and contrast checked against the
existing tokens (no new colours, no hardcoded colour classes).

## Technical notes

- Sidebar grouping: `src/components/app-shell.tsx` only. Route files untouched.
- Renames: `src/lib/i18n-entries.ts` (all locales) plus the components rendering those labels —
  dashboard, cashflow, allocations, settings, loans, wiki content.
- "What's this?": one new small component, reused; content sourced from the existing wiki content
  module so there is a single source of truth.
- Quick-add: `src/components/expense-quick-add.tsx` — progressive disclosure of existing fields, no
  change to the submit payload or any server function.
- No database migrations, no business-logic changes, no new dependencies.

## Explicitly out of scope

- The full information-architecture reshuffle (moving income/bills/goals out of Settings) — that
  needs beta validation first.
- A separate "simple mode" toggle. Two divergent surfaces double the maintenance and the users who
  need the simple one are the least likely to find a toggle.
- Removing any feature or route.
