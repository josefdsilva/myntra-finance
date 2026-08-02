# Compounding Value Over Time — Implementation Plan

_Status: draft for sign-off. Applies to both household and company spaces._

## 1. Why this matters (the north star)

Within a single cycle, bynku is already strong: safe-to-spend, projects, plans, the
snapshot score. The gap is **across** cycles. Today almost nothing gets more valuable
the longer you use the app — history is thrown away at each rollover.

This track turns time into the product's moat: the more cycles a household or company
records, the more bynku can show progress, catch drift, and coach from real behaviour.
That is what makes leaving expensive and returning easy.

Guiding principles, carried from the rest of the app:

- **Ratio-first / no leaking numbers.** Anything shareable (score trend, superfluous
  share) stays relative. Raw amounts live behind RLS exactly like the rest of the data.
- **Cycle-native, not calendar-native.** A cycle can straddle two months (e.g. 25 Jul →
  24 Aug). Every metric is per-cycle, using `fetchCycleBounds` / `cycleFor`, never "this
  month".
- **Point-in-time truth.** A cycle's score and estimates as they were *at close* cannot
  be faithfully recomputed later. They must be captured when the cycle ends — this is the
  whole reason for a snapshot table rather than on-the-fly computation.
- **Encourage, don't nag.** Trends and momentum are opportunities; gate anything that
  fires a tip by significance and keep it dismissible.

## 2. Scope

Four pillars requested, plus three low-cost additions that ride on the same foundation.

| # | Pillar | Household framing | Business framing |
|---|--------|-------------------|------------------|
| 1 | **Financial score evolution** | Snapshot health score per cycle, trend + delta | Business health score per cycle |
| 2 | **Superfluous / consumption trend** | nice-to-have + treat share, consumption ratio over time | discretionary / overhead share over time |
| 3 | **Estimate-vs-actual accuracy** | baseline & variable estimates vs real; plans intention vs reality | budgeted costs/revenue vs actual; runway estimate vs real |
| 4 | **Cycle-vs-cycle comparison** | this vs last vs 3-cycle avg: income, spend, surplus, saved | revenue, costs, margin, cash movement |
| 5 | **Streaks & momentum** _(add)_ | consecutive cycles saving / under budget / superfluous down | consecutive profitable / positive-cashflow cycles |
| 6 | **Milestones** _(add)_ | "6 cycles tracked", "net worth crossed X", "emergency fund full" | "runway ≥ 6 months", "N profitable cycles" |
| 7 | **Coach memory** _(add)_ | longitudinal facts in the coach context ("score up 3 cycles running", "estimates run 12% low") | same, business-framed |

Everything is folded into the **Analysis** section (a new "Over time" block with a
time-range control) plus small surfaces on Snapshot and Dashboard — no separate "Trends"
tab, per the earlier decision.

## 3. Architectural foundation — the `cycle_metrics` snapshot table

One row per `(space, closed cycle)`, written at cycle close and read cheaply forever.

### 3.1 Schema (migration `supabase/migrations/2026xxxx_cycle_metrics.sql`)

```
cycle_metrics
  id                uuid pk default gen_random_uuid()
  household_id      uuid not null references households(id) on delete cascade
  kind             text not null            -- 'personal' | 'business' (denormalised for filtering)
  cycle_start      date not null            -- canonical cycle key
  cycle_end        date not null
  -- money (actuals)
  income_actual    numeric not null default 0
  spend_actual     numeric not null default 0
  fixed_total      numeric not null default 0
  debt_total       numeric not null default 0
  project_funded   numeric not null default 0   -- realAllocated for the cycle
  surplus_actual   numeric not null default 0
  everyday_pool    numeric not null default 0
  everyday_spent   numeric not null default 0
  available_end    numeric not null default 0
  -- quality
  score_overall    numeric                       -- null if not scoreable that cycle
  superfluous_share numeric                      -- 0..1, null if no spend
  consumption_ratio numeric                      -- outgoings / income
  -- estimates (for calibration; captured at close, not recomputable)
  income_expected  numeric
  planned_spend    numeric                       -- baseline + unfunded planned one-offs
  baseline_at_close numeric
  -- extensibility + point-in-time detail (sub-scores, business KPIs, plan intentions)
  metrics          jsonb not null default '{}'::jsonb
  -- meta
  source           text not null default 'close' -- 'close' | 'cron' | 'backfill'
  created_at       timestamptz not null default now()
  unique (household_id, cycle_start)
```

- Promoted numeric columns are the ones we plot/filter; anything richer (sub-score
  breakdown, business margin/runway, per-plan intention-vs-actual) goes in `metrics`
  JSONB so we never need a migration to add a chart.
- **RLS** mirrors other household-scoped tables (member-of-household read; writes via
  `SECURITY DEFINER` server fn / service role only).
- `source` lets the UI mark backfilled rows as approximate.

### 3.2 Types

Regenerate `src/integrations/supabase/types.ts`; add a hand-written `CycleMetrics`
domain type in the engine (below) so callers don't depend on the raw row shape.

## 4. Shared engine — `src/lib/cycle-metrics.ts`

Pure, unit-tested, kind-aware. No I/O.

- `computeCycleMetrics(inputs): CycleMetrics` — takes the same primitives the Snapshot and
  Dashboard already gather (income, fixed, debt, expenses with intent, allocations,
  baseline, plans, cycle bounds) and returns the row payload. Reuses:
  - `computeHealth` / `computeBusinessHealth` from `health-score.ts` for `score_overall`
    and the sub-score JSON.
  - `summariseIntent` from `intent.ts` for `superfluous_share`.
  - `buildForecast` / plan helpers from `plan.ts` for `planned_spend` and plan
    intention-vs-actual.
- Series helpers over `CycleMetrics[]`:
  - `trend(series, key)` → slope + direction
  - `deltaVsPrev(series, key)` and `vsAverage(series, key, n)`
  - `streak(series, predicate)` → consecutive count (saving, under budget, superfluous
    falling, profitable…)
  - `calibration(series)` → mean signed error of estimate vs actual (the number the coach
    quotes).

This keeps every screen and the coach reading one consistent computation.

## 5. Write path (idempotent, three triggers)

A single server fn is the only writer:

- `snapshotCycle({ household_id, cycle_start })` — computes metrics for that closed cycle
  and **upserts** on `(household_id, cycle_start)`. Safe to call repeatedly.

Triggered from:

1. **Event/payday spaces** — after `markIncome` succeeds in the Dashboard "salary
   received → new cycle" flow (`dashboard.tsx confirm()`), snapshot the cycle that just
   closed.
2. **Time-driven spaces** — extend the existing daily `api/public/hooks/cycle-start.ts`
   (already runs at 08:00 Europe/Lisbon, already detects fresh rollovers) to call
   `snapshotCycle` for the just-ended cycle before it sends the outlook email.
3. **Lazy backfill** — when Analysis loads, detect closed cycles with no row and
   backfill from existing expense/allocation/plan data (`source = 'backfill'`). Money is
   fully reconstructable; historical score/estimates are approximate and flagged.

## 6. Phased delivery

Each phase is independently shippable and typechecks on its own.

**Phase 0 — Sign-off.** This document. Confirm scope, table shape, effort.

**Phase 1 — Foundation (no UI).** Migration + RLS + types; `cycle-metrics.ts` engine +
`cycle-metrics.test.ts`; `snapshotCycle` server fn; backfill routine. De-risks all UI
work because the data model is proven first.

**Phase 2 — Write triggers.** Wire `markIncome` success, the cron hook, and lazy backfill.
Verify idempotency (re-running never duplicates or double-counts).

**Phase 3 — Score evolution.** Snapshot page: sparkline of `score_overall` + delta vs last
cycle. Analysis "Over time" block with a time-range control (3 / 6 / 12 / all cycles),
household and business score both supported.

**Phase 4 — Cycle-vs-cycle comparison.** Bars/table: this vs last vs 3-cycle average across
the kind-specific metric set (household: income/spend/surplus/saved; business:
revenue/costs/margin/cash).

**Phase 5 — Superfluous / consumption trend.** Line over cycles + "improving N cycles"
badge; links back to the Snapshot consumption pillar so the story is consistent.

**Phase 6 — Estimate-vs-actual accuracy + coach.** Calibration card (planned vs real, signed
error %, plan intention vs reality). Feed `calibration(series)` into `coach.functions.ts`
so advice references drift ("your everyday estimate has run ~12% low for 3 cycles — want to
raise the baseline?"). Optional gentle tip when drift is large and persistent.

**Phase 7 — Streaks, momentum & milestones.** Dashboard streak chip; milestone cards/toasts.
All dismissible, all significance-gated.

**Phase 8 — Coach memory, wiki & i18n polish.** Longitudinal facts in coach context; new
"Your progress over time" wiki section; full 5-locale pass; end-to-end verification.

## 7. Business vs household

The engine is shared; only the **metric set and copy** differ, exactly like the existing
`.biz` tip variants and the two scoring functions. Household leads with score, saving,
superfluous share; business leads with margin, cash movement, runway, profitable-cycle
streaks. Both read the same `cycle_metrics` table (the `kind` column and JSONB carry the
divergence), so charts and comparisons share one code path.

## 8. Privacy & correctness guardrails

- Snapshots are per-space and RLS-protected; nothing new is exposed cross-space.
- Any surface intended to be shareable (score trend, superfluous share) stays ratio-based.
- Cycle-length variability is handled by storing both bounds and normalising per-cycle, not
  per-calendar-month.
- Backfilled rows are labelled approximate so a reconstructed past score is never presented
  as if it were measured live.

## 9. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Backfilled scores look authoritative | `source='backfill'` + "estimated" styling; exclude from streak claims |
| Rollover missed (cron down, manual skip) | Idempotent `snapshotCycle` + lazy backfill fills gaps on next Analysis load |
| Metric creep forces migrations | Promote only chartable numerics; everything else in `metrics` JSONB |
| Nagging on trends | Significance thresholds + dismissible, mirroring the tips engine |
| Double counting resolved plans | Reuse existing `leftoverObligation` / `expense_id` exclusions already in `plan.ts` |

## 10. Rough effort

Phase 1–2 (foundation + writes) ≈ the heavy lift and the risky part. Phases 3–5 are mostly
charts over data that already exists once the table is populated. Phase 6 is the highest
*value* (coach calibration is the retention hook) but depends on 1–2. Phases 7–8 are polish.

## 11. Open decisions for you

1. **Backfill depth** — reconstruct history for existing users from day one, or start
   fresh from the next cycle close? (Backfill is nicer but money-only-accurate for the
   past.)
2. **First slice to build** — I'd recommend Phases 1 → 2 → 3 (foundation, writes, score
   evolution) as the first shippable increment, then 6 (coach calibration) as the
   value spike. Agree, or reorder?
3. **Milestones surface** — quiet cards in Analysis, or celebratory toasts on the
   Dashboard when hit?
