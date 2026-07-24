# Architecture & invariants

Orientation for anyone (human or AI) changing this codebase. Keep it current.

## Domain model — two layers

The money model is deliberately split into **assumptions** and **actuals**.

**Assumptions (the plan / definitions).** Recurring, steady-state figures:
- `incomes` — recurring inflows (with `cadence`, `native_amount`, `type`).
- `fixed_expenses` — recurring fixed costs (with `cadence`, `native_amount`).
- `variable_estimates` — everyday spending envelopes per category.
- `debts` — loans (amortised; `monthly_amount` is the servicing cost).

These feed `households.baseline_budget` — the target cost of living — which is
maintained **by a database trigger** (fixed + debt + variable + safety margin).
The client never writes `baseline_budget` directly.

**Actuals (reality).** What actually happened:
- `expenses` — logged transactions. `kind` ∈ expense | income; income rows with
  `is_salary = true` are the cycle-anchoring receipts; `income_id` links a
  receipt to the recurring income it fulfils.
- `fixed_expense_settlements` — a per-payment "this fixed cost was paid" overlay
  (businesses). Deliberately does **not** feed baseline or "actual out".
- `plans` — dated one-offs (and recurrences) with expected → resolved actuals.
- `buckets` (projects), `assets` — savings/investment balances and net worth.
- `invoices` — files in a private bucket, attached to an expense, plan, or
  settlement.

## Cycles

A space's budgeting period. Two modes (`households.cycle_mode`):
- **event** — payday-driven, variable length. Derived from the anchor income's
  `is_salary` receipts. Households default here.
- **time** — fixed calendar period (`cycle` length + `cycle_anchor_date` fiscal
  start). Businesses default here.

Resolve it in exactly one place: `fetchCycleBounds(sb, householdId, space)`
(client + server) → `cycleFor(cycleConfigForSpace(space), receipts)`. Add the
cycle-config fields to a React Query key with `cycleKeyPart(space)`.

**Reconciliation is at the line's cadence, not the cycle.** A monthly salary in
a quarterly cycle is three pay runs (`reconcileOccurrences`), each with its own
real amount and invoice. The definition amount stays the *estimate*; occurrences
carry the *actuals*.

## Invariants (do not break these)

1. **One source of truth per number.** A recurring item lives in exactly one
   place. Never let two tables feed the same total (baseline, actual-out, net) —
   that is where double-counting bugs come from.
2. **Definition = estimate, occurrence = actual.** Baseline/forecast read the
   definition; the ledger reads occurrences. Keep them from feeding each other.
3. **Data isolation, always.** Every table is RLS-gated by
   `private.is_household_member(household_id, auth.uid())`. Storage objects are
   namespaced by household id as the first path segment and guarded the same way.
   No cross-household read is acceptable, ever. The public privacy page must stay
   public and must not change.
4. **Cross-cutting reads go through the shared helper** (`fetchCycleBounds`),
   not re-derived per screen.

## Conventions

- **i18n.** Five locales (en/pt/es/de/fr), parity enforced by the `MessageKey`
  type. New copy goes in `i18n-entries.ts` (`ENTRIES`, one edit, all locales) —
  not the legacy per-locale blocks. No long/em dashes in user-facing copy.
- **Migrations.** Additive and **expand/contract** only (add → backfill →
  dual-read → much later drop). Idempotent where possible (`IF NOT EXISTS`).
  Backend is Lovable Cloud: **export before every migration**; rollback is manual.
  See `docs/tech-debt-plan.md`.
- **Server fns.** `createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
  .inputValidator(zod).handler(...)`; `context.supabase` is user-scoped (RLS
  applies), `context.userId` is the caller.
- **Types.** `src/integrations/supabase/types.ts` is generated — Lovable keeps it
  in sync. Hand-edits are a stopgap; reconcile against Lovable's output.

## Tests

Pure logic is unit-tested and should stay that way: `cycle.test.ts`,
`cadence.test.ts`, amortization, plan forecast, health score. Add a test when you
touch the money-math; it's the cheapest safety net for refactors.
