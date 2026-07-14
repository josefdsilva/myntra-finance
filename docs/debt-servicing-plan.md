# Debt servicing & fund movements — implementation plan

## Goal

Let users move money between their cash, savings/investment projects, and debts, and
service (overpay) debt at any point in a cycle. Debts are presented as a special kind of
project with a real amortization-aware progress bar (APR, maturity, installment), and an
overpayment recomputes the loan — reducing either the monthly installment or the term, at
the user's choice.

## Decisions locked in

- **Explicit movements, no negative amounts.** Every action is a positive-amount movement
  with a direction and a reason.
- **Accounts + movements model.** Cash, each bucket, and each debt are "accounts"; every
  action is a movement between two of them.
- **Movements alongside allocations.** Keep `bucket_allocations` for the existing
  "confirm this cycle's planned allocation" flow; add a new `account_movements` ledger for
  add / withdraw / transfer / service-debt. Bucket balance folds in both.
- **Debts stay their own table**, presented as special projects in the UI (they carry APR,
  installment, maturity that buckets don't).
- **Overpayment = 100% principal**, then recompute installment or term (user chooses).
- **Straight principal reduction** for overpayments (no manual interest/principal split on
  the user side — the engine derives everything from APR + schedule).

## 1. Concepts

Four user-facing actions, one underlying row shape (`from_account → to_account`):

| Action        | From      | To        | Cash flow this cycle? |
| ------------- | --------- | --------- | --------------------- |
| Add funds     | cash      | project   | yes (outflow)         |
| Withdraw      | project   | cash      | yes (inflow)          |
| Transfer      | project A | project B | no                    |
| Service debt  | cash      | debt      | yes (outflow)         |
| Service debt  | project   | debt      | no                    |

"Project" = a `buckets` row (savings/investment) or a `debts` row (special project).

## 2. Data model

### 2.1 `debts` — new columns

The table currently stores `principal_remaining`, `monthly_amount`, `taeg_pct`,
`maturity_date`. Add:

- `starting_principal numeric` — original principal (progress-bar denominator).
- `opened_at date` — schedule anchor (start of the current amortization schedule).
- `last_recompute_at date` — set whenever an overpayment resets the schedule.
- (optional) `rate_kind text default 'taeg'` — see open question on TAEG vs TAN.

`principal_remaining` becomes the balance **as of `last_recompute_at`** (or `opened_at`).
The live balance for "today" is derived analytically by the amortization engine (§4), so
normal monthly installments advance the progress bar automatically without logging each one.

### 2.2 New table `account_movements`

```sql
create type movement_account_type as enum ('cash', 'bucket', 'debt');
create type movement_kind as enum (
  'deposit', 'withdrawal', 'transfer', 'debt_payment'
);

create table account_movements (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  period          date not null,                 -- cycle anchor, like bucket_allocations.period
  kind            movement_kind not null,
  from_type       movement_account_type,
  from_id         uuid,                           -- bucket/debt id; null when cash
  to_type         movement_account_type,
  to_id           uuid,
  amount          numeric not null check (amount > 0),
  reason          text,                           -- user-selected reason / label
  note            text,
  -- debt overpayment bookkeeping (null for non-debt movements):
  principal_before numeric,
  principal_after  numeric,
  recompute_mode   text,                          -- 'reduce_installment' | 'shorten_term'
  created_by       uuid not null,
  created_at       timestamptz not null default now()
);

create index on account_movements (household_id, period);
create index on account_movements (household_id, to_type, to_id);
create index on account_movements (household_id, from_type, from_id);
```

RLS: identical policy shape to `bucket_allocations` — a member of `household_id` can
select/insert; only owners or the creator can delete (match existing conventions).

### 2.3 Balance formulas

- **Bucket balance** = `initial_balance`
  `+ Σ bucket_allocations.amount (bucket)`
  `+ Σ movements.amount where to = bucket`
  `− Σ movements.amount where from = bucket`.
- **Debt live principal** = `amortize(principal_remaining, r, installment, monthsSince(last_recompute_at))`
  (overpayments already folded into `principal_remaining` + a possibly-new installment/term).

## 3. Atomic operations (Supabase RPC)

Multi-row movements must be atomic, so implement them as Postgres functions called via
`supabase.rpc(...)` rather than multiple client writes. Proposed functions:

- `record_deposit(household, bucket, amount, reason)` → one `deposit` row.
- `record_withdrawal(household, bucket, amount, reason)` → one `withdrawal` row (validates
  sufficient balance).
- `record_transfer(household, from_bucket, to_bucket, amount, reason)` → one `transfer` row
  (validates from-balance).
- `service_debt(household, debt, amount, source_type, source_bucket, recompute_mode, reason)`
  → validates; if `source_type='bucket'`, checks bucket balance; inserts one `debt_payment`
  movement; recomputes the debt schedule (§4); updates `debts` (`principal_remaining`,
  `monthly_amount` or `maturity_date`, `last_recompute_at`); records
  `principal_before/after` + `recompute_mode`. All in one transaction.

Each validates household membership via `auth.uid()` so it's safe to expose.

## 4. Amortization engine — `src/lib/amortization.ts`

Pure, deterministic, dependency-free, fully unit-testable (no DB, no network, no LLM).

```ts
/** Effective monthly rate from an effective annual rate (TAEG). */
export function monthlyRate(annualEffective: number): number;      // (1+a)^(1/12) - 1

/** Standard amortizing installment for principal P, monthly rate r, n months. */
export function installmentFor(P: number, r: number, n: number): number;

/** Remaining term (months) for a given installment; null if it never amortizes. */
export function termMonthsFor(P: number, r: number, installment: number): number | null;

/** Remaining balance after k scheduled payments. */
export function balanceAfter(P: number, r: number, installment: number, k: number): number;

/** Summary for the progress UI. */
export function scheduleSummary(input: {
  principal: number; annualEffective: number;
  installment: number; anchorDate: string; today: string;
}): { remaining: number; paidPrincipal: number; progressPct: number;
      payoffDate: string; totalInterestRemaining: number; monthsElapsed: number };

/** Apply a lump-sum overpayment; returns the new schedule state. */
export function applyOverpayment(state: {
  principal: number; annualEffective: number; installment: number; maturityDate: string;
}, amount: number, mode: 'reduce_installment' | 'shorten_term'):
  { principal: number; installment: number; maturityDate: string };
```

Formulas:

- Installment: `M = P·r / (1 − (1+r)^−n)`.
- Term: `n = −ln(1 − P·r/M) / ln(1+r)` (requires `M > P·r`).
- Balance after k: `B_k = P·(1+r)^k − M·((1+r)^k − 1)/r`.
- Overpayment `X`: `P' = P − X`, then
  - `reduce_installment`: keep `n_remaining`, `M' = installmentFor(P', r, n_remaining)`.
  - `shorten_term`: keep `M`, `n' = termMonthsFor(P', r, M)` → new payoff date.

Edge cases to handle explicitly: `r = 0` (linear amortization: `M = P/n`, `B_k = P − M·k`);
`installment ≤ P·r` (never amortizes → surface a validation error, not an infinite term);
overpayment `≥ P` (debt cleared → mark paid off, balance 0); rounding to cents at the
boundary only.

## 5. UI changes

- **Projects screen** (`src/routes/_authenticated/allocations.tsx`): show buckets *and*
  debts as cards, each with a progress bar. Debt cards show paid ÷ starting principal,
  projected payoff date, remaining interest, and the monthly installment.
- **MovementSheet** (new): one sheet backing Add / Withdraw / Transfer, with an account
  picker for source/destination and a reason field.
- **DebtCard / OverpaymentDialog** (new): "Make a payment" → amount + source (cash or a
  project) + a clear **reduce-installment vs shorten-term** choice, with a live preview of
  the new installment or new payoff date computed by the engine before confirming.
- Reuse `income-allocation-suggestion.tsx` patterns where possible; keep toasts + query
  invalidation consistent with the current allocation flow.

## 6. Consistency touchpoints

- **Analysis burndown** (`analysis.tsx`): a debt payment *from cash* is an outflow in the
  current cycle; *from a project* is not cash flow and must not appear in the burndown.
- **Benchmarks**: already exclude debt as non-consumption — no change needed, and this stays
  correct because overpayments are transfers, not consumption.
- **Cycle report** (`cycle-report.tsx`, `cycle-report.functions.ts`): extend the buckets
  section to include debt payoff progress and any overpayments made in the cycle.
- **Notifications**: optional later — "debt fully paid off" or "on track to finish early".

## 7. i18n

New keys for the movement sheet, debt card, overpayment dialog, reasons, and validation
messages — added to all five locale bundles (`en`, `pt`, `es`, `de`, `fr`) in
`src/lib/i18n-messages.ts`, following the pattern established for the benchmark keys.

## 8. Build order (phased, each independently shippable)

1. **Amortization engine + unit tests** — pure module, no DB. Validates the math first.
2. **Migration** — `debts` columns, `account_movements`, enums, RLS, RPCs.
3. **Balance layer** — extend the bucket-balance hook/query to fold in movements; add a
   debt-balance hook using the engine.
4. **UI** — Projects unification, MovementSheet, DebtCard, OverpaymentDialog.
5. **Consistency** — burndown, cycle-report.
6. **i18n + QA pass.**

## 9. Testing

- Unit tests for `amortization.ts` against known loan examples (a fixed-rate loan, a 0% loan,
  an overpayment reducing installment, an overpayment shortening term, full payoff).
- RPC tests: transfer/withdraw refuse to overdraw a bucket; `service_debt` from a bucket
  updates both balances atomically; concurrent movements in a shared household don't desync.
- Scenario walkthrough: add to savings → transfer savings → overpay debt from savings →
  confirm progress bar, payoff date, and burndown all update coherently.

## 10. Open questions / decisions to confirm

- **TAEG vs TAN for the schedule.** `taeg_pct` is the *effective* annual rate (includes
  fees). Amortization schedules are normally driven by the *nominal* rate (TAN). Options:
  (a) approximate the schedule from TAEG (simplest, slightly overstates interest); or
  (b) add a `tan_pct` field and use TAN for the schedule, TAEG for cost display. Recommend
  (b) for accuracy if users know their TAN.
- **Input reconciliation.** On debt creation, require principal + APR + **either** term
  **or** installment, and compute the third; store all three. Confirm this is acceptable.
- **Scheduled installment logging.** Plan assumes normal monthly installments advance the
  schedule analytically (not logged as movements). The existing fixed-expense already covers
  their cash-flow impact. Confirm we don't also want per-installment movement rows.
- **Currency.** Movements assume the household currency; no FX. Fine given the current model.
- **Withdraw "to cash".** Since there's no persistent bank balance, a withdrawal to cash is
  recorded as a cash inflow in the current cycle for the burndown. Confirm that framing.
```
