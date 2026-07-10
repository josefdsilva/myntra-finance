# Foundation cleanup — no functional changes

Goal: prepare the codebase for upcoming features (multi-household, paywall, richer coach) by paying down debt without touching user-visible behaviour. Every change is verified against build + typecheck; behaviour stays byte-identical.

## What I found

- **1,505 auto-fixable Prettier violations** across almost every file (mixed formatting, unbroken JSX props). Nothing behavioural — pure formatting drift.
- **~10 real lint errors**: `any` types in `coach.functions.ts`, `analysis.tsx`, `settings.tsx`. All easy to type properly against `Database` types.
- **~6 real lint warnings**: hook-dependency issues (`expenses.tsx` `allExpenses` in `useMemo`, `settings.tsx` `useEffect` deps), `react-refresh/only-export-components` (minor).
- **No dead files** at module level — everything under `src/lib`, `src/components`, `src/routes` is referenced. `src/routes/README.md` is a doc, keep.
- **Duplicate patterns worth extracting** (each used 3+ times, currently copy-pasted):
  - Household-membership check (`select user_id from household_members where …`) in every protected server fn.
  - `rowsOrEmpty<T>(rows)` cast helper (currently inlined in `settings.tsx`).
  - Cycle-bounds computation is already in `src/lib/cycle.ts` but a few callers redo it inline.
- **`coach.functions.ts`** — `buildContext` is 100 lines, mixes 6 Supabase queries with aggregation. Refactor into a typed helper for readability + reuse by the upcoming "improved coach".
- **TypeScript strictness**: typecheck is already clean, but explicit `any`s hide the shape of DB rows from future edits.
- **Console noise**: only server-side `console.error` on real failure paths — fine, leave.
- **TODOs**: none.

## Plan (small, isolated commits' worth of work — one turn)

1. **Prettier pass** — run `bunx eslint --fix` on `src/**/*.{ts,tsx}` to normalise formatting across the tree. Pure whitespace/line-break changes. Verified by re-running lint + typecheck.
2. **Kill real `any` usages** (functional code only, not `routeTree.gen.ts`):
   - `src/lib/coach.functions.ts`: introduce a `Supa` type alias (`SupabaseClient<Database>`) and typed row shapes for the 6 queries in `buildContext`.
   - `src/routes/_authenticated/analysis.tsx`: type the Recharts `BurnTooltip` props via `TooltipProps` and the buckets reducer via generated types.
   - `src/routes/_authenticated/settings.tsx`: type `BucketRow` props against `Database["public"]["Tables"]["buckets"]["Row"]`.
3. **Fix real hook warnings** without changing behaviour:
   - `expenses.tsx`: memoise `allExpenses` so downstream `useMemo`s have a stable dep.
   - `settings.tsx`: stabilise the offending `useEffect` with `useCallback`/dep list — same debounced-save behaviour, no re-fires.
4. **Extract 2 tiny shared helpers** (no new abstractions, only where already duplicated):
   - `src/lib/household-guard.server.ts` → `assertHouseholdMember(supabase, householdId, userId)` throws `Not a member` — replaces 6 inlined copies across `coach`, `privacy`, `bucket-allocations`, `budget`, `household`, `push` server fns.
   - `src/lib/query-utils.ts` → `rowsOrEmpty<T>(rows: T[] | null | undefined): T[]` — replaces the ad-hoc helper in `settings.tsx` and 4 similar inline casts.
5. **Docs**: add a short `AGENTS.md` note under "Conventions" pointing future work at these helpers so we don't re-introduce the duplication.

Explicitly **not** in scope this turn (call them out for later):
- Splitting large route files (`allocations.tsx` 627 LOC, `settings.tsx` 716 LOC, `dashboard.tsx` 476 LOC) — worth doing before the multi-household work, but is a bigger visual-diff PR and easier to review on its own turn.
- Multi-household context provider — belongs with the actual feature.
- Paywall/billing scaffolding — needs product decisions first.
- Coach v2 refactor — will build on the typed `buildContext` from step 2.

## Verification

After the pass I'll run `tsgo --noEmit` and `eslint` and report: 0 typecheck errors, 0 real lint errors (only the unavoidable `react-refresh/only-export-components` warnings in route files where TanStack requires `Route` + `component` to coexist).

## Technical notes

- No migrations, no schema changes, no route additions/removals.
- No package installs.
- `routeTree.gen.ts` is left untouched (auto-generated).
- Server-function public signatures unchanged → client callers untouched.
- I18n dictionary untouched (no new strings).
