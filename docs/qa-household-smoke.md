# Household QA smoke pass

A ~15-minute manual pass over the full household loop. The goal is to confirm the
**shared numbers agree across screens** (net worth, surplus, safe-to-spend) and
that the cycle/plan/retirement flows behave. Do it on a real (or reset) personal
household. Mark each ✅/❌ and note the numbers.

Prereqs: `bun run tsc` clean, `bun test` green, all migrations applied
(latest: `20260729160000_movements_delete_lockdown`).

## 0. Clean slate (optional)
- [ ] Settings → Danger Zone → **Start fresh** → type `RESET`. Lands in onboarding. No stale data remains.

## 1. Onboarding
- [ ] Country, cycle, household (adults/children **+ age band**), income, fixed costs, variable estimate, debt, projects all save and advance.
- [ ] The **first income** you add ends up typed **Salary** (check Money In afterwards). Age band is stored.
- [ ] Finishing lands on the dashboard (no redirect loop).

## 2. Dashboard — safe to spend
- [ ] Safe-to-spend is **non-zero and sensible** (not 0 unless you genuinely have no variable room). Regression guard for the plan-window bug.
- [ ] Default horizon is **Next 7 days** (or **Rest of cycle** if <7 days left).
- [ ] Note **Net worth** (NetWorth card) = `A`. Note **monthly surplus** = `S`.

## 3. Allocations (Save & Invest)
- [ ] "Real surplus" / leftover reconciles with the dashboard surplus `S` (income − baseline − real allocations).
- [ ] Confirming an allocation is **additive** (doesn't overwrite a prior larger amount).
- [ ] No `<PCT>`-style placeholder leaks in the split copy.

## 4. Receive salary → cycle rolls
- [ ] Mark the salary income **received**. The cycle **rolls over** (This Cycle resets, ledger shows the receipt).
- [ ] Repeat with salary **untagged** (retype it to `other` in Money In, then receive it): the cycle **still rolls** (largest-income fallback). Retag it Salary afterwards.

## 5. Expenses + intent scale
- [ ] Add a spend expense, set its **need-level** (Essential→Treat). It appears in This Cycle.
- [ ] Analysis reflects the spend; the intent selector doesn't overlap other metadata on mobile.

## 6. Plans in the current cycle
- [ ] Add a **spend plan** dated in the current cycle → it shows under **This Cycle / Planned** (tinted).
- [ ] Safe-to-spend/real-surplus adjust for it as expected (open plans reserve leftover first, overflow spills to everyday).
- [ ] Cycle Report → "Looking ahead: next cycle" shows a **non-zero planned spend** (fixed + estimated + debt + plans), not €0.

## 7. Analysis → How you compare
- [ ] **Market snapshot**: inflation, unemployment, Euribor 3M/12M render with an "as of" line.
- [ ] Income percentile + spending comparison show; **coverage %** looks reasonable (debt/savings listed as "not compared", not dragging coverage down).
- [ ] **Net worth vs similar households** shows (needs income + net worth); **debt-to-income** tile shows if you have a loan.
- [ ] For a non-curated country (set country to e.g. Belgium in Settings), the card shows **"not available"** — never Portugal's data by default. Restore your country after.

## 8. Coach
- [ ] Ask "how am I doing" — the coach's **net worth matches `A`** (dashboard), and its surplus matches `S`. (Regression guard for the debt-basis fix.)
- [ ] Ask "how does my net worth compare" — cites the HFCS peer median; suggests setting an age band if none.
- [ ] Ask a retirement/what-if question — answers with principles, no fabricated numbers.

## 9. Fast Forward (retirement + job change live here now)
- [ ] Add a **Retire** event: pick a future month + monthly pension; the **"Replaces which salary?"** picker lists your salary income (or shows the single-salary line). Net-worth chart updates; salary stops, pension starts at that month.
- [ ] Add a **New job / salary change** event: net worth diverges from the baseline line.
- [ ] The **"current net worth"** shown equals `A` (dashboard), and **current monthly surplus** equals `S`.
- [ ] Pick a far horizon (e.g. 30–40y): chart still renders (payload downsampled), endpoints exact.

## 10. Net-worth consistency (the key invariant)
- [ ] Dashboard NetWorth card == Snapshot net worth == Coach net worth == Fast Forward "current" == the same number `A`. Any mismatch is a bug.

## 11. Reset / privacy
- [ ] Export data (Danger Zone) downloads a JSON.
- [ ] Start fresh wipes everything and re-runs onboarding; membership/currency survive.

## Known limitations (expected, not bugs)
- Fast Forward retirement/salary-change only replaces **salary-typed** income.
- Benchmarks are curated snapshots (income deciles 2023, HBS 2020 uprated, HFCS 2021) — approximate, not live.
- Plan reservation on the dashboard uses the **calendar month** (not the exact cycle window) — deliberate, after the safe-to-spend regression.
