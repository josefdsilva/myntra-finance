# Values-tailored journey

Bynku's differentiator: money is a means to what a household actually cares about. We ask who the household is (ages, roles) and what it values, then tailor the journey, the projects, the coach's language, and the essential/treat scale around those values — with a thin financial backbone (safety net, debt, ratios) framed as protecting what matters.

## Decisions

- Collect ages and role/job per household member.
- Alignment (money spent on what matters) is surfaced everywhere: dashboard, journey, expenses, coach, cycle report.
- Values-aligned projects are suggested with one-tap add, never created silently.

## 1. Who the household is

New setup step (early, skippable, editable later in Settings): a small member list — first name, age, role/job (e.g. employed, self-employed, student, homemaker, retired, child). Derived signals: youngest child's age, years to retirement for each adult, dependants count. These tune the journey (school horizon, retirement rung) and benchmark comparisons.

## 2. Values step

Pick up to three values, ranked, from a localized list: family time, travel, health, home, giving, learning/career, freedom & security, little treats, environment, community, plus a free-text "something else". Asked as the first content step of setup, skippable, and editable in Settings (changing them re-drafts the journey with a confirm step).

## 3. Values-aware intent

Today intent (essential / important / nice-to-have / treat) falls back to a fixed category map. It becomes values-aware: a category tied to a chosen value is promoted one level (travel becomes important, or essential when it's the #1 value); categories tied to no chosen value and already discretionary stay where they are. Manual per-expense tags always win. Every place that shows a need-level explains "important to you because you value travel".

## 4. Alignment, visible everywhere

One shared computation: of flexible (non-essential) spending this cycle, what share went to categories tied to the household's values, versus what leaked elsewhere.

- Dashboard: an Alignment card — "62% of your flexible spending went to what you said matters", with cycle-over-cycle direction.
- Journey: rungs framed in value language, plus alignment as a supporting line.
- Expenses: a small aligned/off-values marker per row and a cycle summary line.
- Coach and cycle report: surplus is described as progress toward the values ("this cycle you freed EUR 240 — that's a fifth of next summer's trip"), and leaks are named gently, never scolded.

No punitive language: off-values spending is shown as an opportunity, and the coach always offers the swap.

## 5. Tailored journey

`draftJourney` keeps its financial backbone but re-frames and re-orders it around values and life stage:

- Backbone stays: starter buffer, expensive debt, 3 and 6 months of cover, first invested month. Titles are re-worded as protection of the values ("Protect the family: one month of cover").
- Values rungs are interleaved: a travel household gets "Fund next year's trip"; giving gets "Give X per year without strain"; learning gets a course/education fund; family gets a kids' fund sized to the youngest child's horizon.
- Life stage adjusts targets: adults near retirement get an earlier retirement rung; households with young children get a larger buffer target.
- Re-drafting is idempotent and never deletes user-authored stages.

## 6. Suggested projects

After setup (and on the journey page) bynku shows 2-3 suggested buckets derived from values, country benchmarks, and surplus — e.g. "Next trip: 6,000 EUR by next July" — each with a one-tap add. Nothing is written until tapped.

## Technical notes

- Migration: `households.values` (JSONB, ranked array) and a `household_people` table (household_id, name, age, role, sort_order) with the standard grants, RLS via household membership, and updated_at trigger. No changes to existing money tables.
- New `src/lib/values.ts`: value catalog, value-to-category map, `intentForExpense(values, expense)`, `alignmentSummary(values, expenses)` — pure and unit-tested alongside `intent.test.ts`.
- `src/lib/intent.ts` gains an optional values argument; the existing signature keeps working so no caller breaks.
- Server fns: extend `updateHousehold` with values; new `listPeople`/`upsertPerson`/`deletePerson` in `src/lib/household.functions.ts`; `draftJourney` reads values plus people and gains the values rungs; `suggestProjects` returns tap-to-add bucket specs.
- Onboarding: two new steps in `src/routes/_authenticated/onboarding.tsx`, both skippable, plus Settings editors.
- Coach: values, ages, and alignment go into the grounded facts in `src/lib/household-facts.ts` so all coach copy can use them; prompt stays concise.
- i18n: all new copy through `ENTRIES` in `src/lib/i18n-entries.ts`, five locales.

## Out of scope

Bank-statement import improvements, staleness nudges, chat-based data entry — separate work.
