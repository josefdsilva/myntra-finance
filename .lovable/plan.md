# Faster setup: 3 questions, then a real number

Today the wizard walks up to 11 screens (country, cycle, household, categories, income, fixed, variable, margin, debt, assets, projects, plans) before anyone sees a dashboard. That is where new users stall. The coach-assisted chat stays available, but it is still the same long script.

The recommendation combines your second and third ideas, plus one addition: **estimate first, correct later**. Ask only what cannot be guessed, guess the rest from the country benchmark data already bundled in the app, and land on the dashboard where every guessed number is visibly marked and one tap away from being fixed.

## The new flow (personal space)

1. **Where and who** — country, adults, children, age band. One screen.
2. **What comes in** — one amount: total monthly money in (plus an optional "add another" for a second income). One screen.
3. **When your cycle starts** — payday-anchored or fixed day of the month. One screen.
4. **Here is your starting plan** — generated, not asked:
   - Estimated monthly fixed costs and variable costs, split per category, derived from the bundled benchmark data (`avgMonthlyHouseholdExpenditure`, `categoryShares`, `quintileExpenditureMultipliers`, equivalence factor for the household size, and the income quintile implied by step 2).
   - A suggested savings margin instead of the slider.
   - Shown as an editable list: each row has the amount, the category and a "estimated" tag. The user can edit, delete or accept all.
   - Two buttons: **Use these and continue** or **I'll enter my own** (drops into today's income/fixed/variable steps).
5. Finish → dashboard, with the first useful numbers already populated.

Debt, assets, projects and plans leave the wizard entirely. They become checklist items on the dashboard (the existing `SetupChecklist`), so nobody is blocked by them.

Business spaces keep the same shape: where/sector/employees → money in → fiscal cycle → generated cost preset from the business benchmark data.

## Making the estimates honest

An estimated number that silently pretends to be real is worse than no number. So:

- Every preset-created row is tagged as an estimate (a `source`/note marker on the row) and rendered with a subtle "estimated" chip in Money In & Out.
- The dashboard shows one line: "Some costs are still estimates from national averages — confirm them to sharpen your plan," linking to Money In & Out.
- Confirming a row (edit or tick) clears the estimate tag; the checklist item completes when no estimates remain.
- The analysis/benchmark screens already explain the data source; the estimate chip links to that explanation.

## Everything is skippable

Every step, including the three questions and the preset screen, has a visible "Skip for now" (and a "Finish later" on the header that closes the wizard). Skipping never blocks the dashboard:

- Skipping the preset screen writes nothing — the space starts empty and the dashboard shows what it can.
- Whatever was skipped becomes an item in the dashboard checklist, so nothing is lost.
- The wizard can be reopened any time from Settings ("Run setup again"), resuming where it stopped.

## The coach helps with setup at any time, not just in the wizard

The coach becomes the permanent guided-setup path, not a one-off onboarding mode:

- The existing coach dock gains a "Help me finish setting up" entry that runs the same topic script as the wizard (income, fixed, variable, debt, projects), extracting rows the user confirms before anything is written. Available forever, for a space that is fully set up or barely started.
- The coach can also be asked in free text ("add my rent, 700 a month") and will propose rows to confirm on any screen.
- Proactive nudges: the daily coach run checks the same gaps the checklist tracks and, when something important is missing (no income, no fixed costs, costs still estimates, no cycle set), posts one coach message the user can answer inline — the reply feeds straight into the same extraction-and-confirm flow. Rate-limited to one setup nudge at a time, deduped, and silenced once the gap closes or the user dismisses it.

## Bank statement as the fast lane, stated plainly

The statement path already exists but is easy to miss. It gets promoted:

- On the welcome step and on the preset step: "Prefer not to type? Upload 3–6 months of bank statements (PDF or CSV) and bynku will work out your income, fixed costs and variable costs for you." with a direct button into the statement import flow.
- Same call-out on the dashboard checklist and inside the coach's setup script.
- The import result lands in the same confirm-before-save review the presets use, so the three paths (type it, estimate it, import it) converge on one screen.
- The copy states the limits honestly: it reads what's in the file, categorises with AI, and the user confirms everything before it is saved.


## Resuming and existing users

- The saved step position keeps working; anyone mid-way through the old wizard is mapped to the nearest new step.
- Already-onboarded spaces are untouched — no retroactive estimates.

## Technical notes

- New `src/lib/setup-presets.ts`: pure function taking `{ country, adults, children, monthlyIncome, isBusiness }` and returning suggested fixed rows, variable rows and a margin, built from `src/lib/benchmarks/*.json` via the existing helpers (`equivalenceFactor`, `percentileFromDeciles`, `quintileFromPercentile`, `getCountryBenchmark`). Unit-tested like the other `src/lib/*.test.ts` files.
- `src/routes/_authenticated/onboarding.tsx`: reduce `STEPS` to `welcome → whereWho → income → cycle → preset`, move `DebtStep`/`AssetsStep`/`ProjectsStep`/`PlansStep` out of the wizard (components stay, reused by their own pages).
- Preset rows are written through the existing `upsertFixedExpense` / `upsertVariableEstimate` server functions on confirmation — no new tables. The estimate marker uses a note/intent field on those rows, so no migration is needed unless we want a dedicated flag (decide during build).
- `src/components/setup-checklist.tsx` gains items for debt, assets and "confirm your estimated costs".
- `src/components/coach-onboarding.tsx`: script trimmed to the three topics plus preset confirmation.
- All new copy goes through `src/lib/i18n.tsx` for the existing five locales.
