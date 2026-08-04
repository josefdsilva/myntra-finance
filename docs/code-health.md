# Code-health plan

The app grew feature-by-feature, and the same primitives now live in many
places. This plan pays that down in risk-ordered slices. Guiding rule: **no
behaviour change** in refactors — `tsc` clean and the test suite green after each
slice, so nothing user-facing shifts.

## Evidence (why)

- The core money math is re-derived in 8+ files: `variablePool = baseline −
  fixedTotal`, `sumMonthly`, liquid-asset sums, cycle bounds — in `dashboard`,
  `snapshot`, `cycle-metrics.functions`, `cycle-report.functions`,
  `coach.functions`, `weekly-digest`, `budget-alerts`, `sme-cash.server`. Two of
  the safe-to-spend bugs we fixed came from these copies disagreeing.
- ~50 `as never` casts across 14 files, almost all working around a stale
  generated `types.ts` (notification_prefs, coach_messages, cycle_metrics,
  waitlist, households' new columns).
- `sumMonthly` is duplicated verbatim ×4; `LIQUID_ASSET_KINDS` ×4, and its
  meaning already drifted (statements uses the same set to mean "investments").
- Mega-files: `i18n-messages.ts` (~6k lines), `settings.tsx` (~1.4k),
  `onboarding.tsx` (~1.3k), `dashboard.tsx` (~0.7k).
- Cron hooks scan every household with per-household N queries, sequentially.

## Phase 0 — Guardrails (you run; low effort, high leverage)

1. **Regenerate Supabase types** (`supabase gen types typescript ... > types.ts`)
   and delete the ~50 `as never` / `as Record<string, unknown>` casts they exist
   to work around. Restores real type-checking on every recent table.
2. **CI**: run `bun run tsc`, `bun test`, and the i18n parity script on every
   push. Most issues we hit this cycle were compile-time only.
3. **ESLint**: enable `no-floating-promises` and react-hooks `exhaustive-deps`.

## Phase 1 — Shared micro-helpers (low effort, low risk) — START HERE

Create `src/lib/finance-helpers.ts` with `sumMonthly`, `LIQUID_ASSET_KINDS` +
`isLiquidAsset`. Refactor the identical call sites (`budget-alerts`,
`weekly-digest`, `sme-cash.server`; liquid set in `coach.functions`,
`cycle-metrics.functions`, `snapshot`). Leave `statements`' set alone (it means
"investments" there) and leave `coach.functions`' `unknown`-typed `sumMonthly`
variant for Phase 2. Acceptance: identical numbers, `tsc` clean.

## Phase 2 — Canonical financial-facts engine (high effort, highest impact)

Build `src/lib/household-facts.ts`: given a supabase client + household, return
the whole computed picture (income, fixed, debt, baseline, variable pool, net
spent, surplus, available, cycle bounds, liquid assets, net worth, score
inputs). Cover it with tests, then migrate consumers one at a time
(dashboard → snapshot → cycle-metrics → cron hooks → coach), deleting each local
re-derivation as it moves. This ends the "same number computed 8 ways" class of
bug and makes new surfaces additive.

## Phase 3 — Decompose mega-files + finish i18n migration

Split `settings.tsx`, `onboarding.tsx`, `dashboard.tsx` by feature. Run the
existing key-first export script to migrate the legacy per-locale `MESSAGES`
blocks into `ENTRIES`, deleting the ~6k-line file and ending the dual-i18n
mechanism. Faster builds, smaller reviews.

## Phase 4 — Cron scalability

Move heavy per-household aggregation into SQL views/RPCs (or `Promise.all`
batching + an "active spaces only" filter), so the daily jobs stop being O(all
households × queries).

## Sequencing

Phase 1 now (safe, and it makes Phase 2 easier). Phase 0 in parallel on your
side. Then Phase 2 is the big win. Phases 3–4 as capacity allows.
