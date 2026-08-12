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

## Coach-assisted setup

Kept, but shortened to the same three questions plus the preset confirmation, so both paths reach the dashboard in the same number of moves. The "use forms instead" escape stays.

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
