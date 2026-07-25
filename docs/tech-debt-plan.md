# Tech-debt reduction & foundation plan

A living document. Goal: pay down accumulated debt before the next feature wave
(business: VAT, corporate income tax, cashflow projection, on-demand balance
sheet; households: coach, wiki, encoded financial principles).

## Database safety (read this before any migration)

The backend runs on **Lovable Cloud**: the Postgres/Supabase instance is owned
and managed by Lovable. Direct external access is severed — no connection
string, no service-role key, no Supabase CLI, no external SQL clients, and no
preview/branching databases. Consequences:

- **Only migrations touch data.** Type files and every code refactor are
  compile-time only — zero data risk.
- **Rollback is painful** (manual `pg_restore`, no branching). So every schema
  change is **expand/contract**: additive first (add column/table, backfill,
  read the new shape behind a flag, verify) and only drop the old thing much
  later, in a separate migration.
- **Export before every migration.** Take a Lovable export as a baseline and one
  before each schema change. To test a risky migration, restore an export into a
  throwaway local Supabase (`supabase start`) and run it there first.
- **Types stay in sync via Lovable**, not the CLI. Hand-edits to
  `src/integrations/supabase/types.ts` are a stopgap Lovable will reconcile.

Open decision: whether to migrate off Lovable Cloud to a Supabase project you
own (real backups, branching, direct access) **before** the finance features.

## Phase 0 — Safety net (no code, no schema changes)

- [ ] Take a baseline Lovable export and store it.
- [ ] Reconcile `types.ts` against Lovable's generated types.
- [ ] `tsc` (typecheck) green.
- [ ] `bun test` green (esp. `cycle.test.ts`, `cadence.test.ts`).
- [ ] Decide Lovable-Cloud vs owned-Supabase.

## Phase 1 — Code-only debt reduction (zero DB risk)

- [x] `fetchCycleBounds` + `cycleKeyPart` helpers (de-duplicate the repeated
      salary-fetch + `cycleFor` + query-key across screens).
- [x] Retire `markSalaryReceived`; the dashboard button reconciles the primary
      income and requires one to exist.
- [x] Dead-import sweep from the cycle rework.
- [ ] (Optional) i18n key-first restructure (`{ en, pt, es, de, fr }` per key).

## Phase 2 — Domain consolidation, expand only (additive migrations, guarded)

Design the unified "cashflow line + occurrence/actual" model that VAT, CIT,
projection, and the balance sheet all sit on. Ship additively: new structures
alongside the old, backfill, dual-read behind a flag, verified against an export
on a local copy. No drops.

## Phase 3 — Pipeline features on the clean foundation

- Business: VAT & corporate income tax as periodic tax obligations; forward
  cashflow projection; on-demand balance sheet (assets − liabilities + equity).
- Households (parallel, DB-light): coach improvements, wiki, financial-principles
  framework.

## Phase 4 — Contract (destructive, last, heavily guarded)

Only once everything reads from the new model and has run cleanly in prod: remove
deprecated tables/columns, with a fresh export and expand/contract discipline.

## Security review (Lovable linter findings)

Reviewed 2026-07. Three findings; verdicts grounded in the actual definitions.

### 1. `beta_codes` RLS enabled, no policies — WON'T FIX (correct as-is)

Fail-closed is deliberate. The only reader is `public.redeem_beta_code(text)`, a
`SECURITY DEFINER` function that validates `auth.uid()`, throttles attempts, and
enforces the seat cap (EXECUTE granted to `authenticated`, revoked from `anon`).
Beta codes are secrets — adding a client read policy would leak the whole
whitelist to any signed-in user. Do **not** add a policy.

### 2. `households` UPDATE policy missing `WITH CHECK` — FIXED

`"Owners can update household"` had `USING` but no `WITH CHECK`, so a row wasn't
re-validated after update. Migration `20260724170000_household_update_with_check.sql`
adds a `WITH CHECK` mirroring the ownership `USING`.

Same pattern still open on `profiles` `"Users can update own profile"`
(`USING user_id = auth.uid()`, no `WITH CHECK`). Not linter-flagged but identical
class; fold the same fix in when convenient.

### 3. SECURITY DEFINER functions callable by `authenticated` (lint 0029) — mostly acceptable

The callable money RPCs are `SECURITY DEFINER` **and authorize the caller**
explicitly, which is the correct pattern (they need definer rights for atomic
multi-table writes, then gate access):

- `public.fund_deposit`, `public.fund_withdrawal`, and the other movement RPCs
  begin with `IF NOT private.is_household_member(p_household, auth.uid()) THEN
  RAISE EXCEPTION`.
- `public.redeem_beta_code` checks `auth.uid()` and only touches the caller's own
  membership/throttle rows.
- `private.*` helpers (`is_household_member`, `current_user_household`,
  `bucket_balance`) live in the `private` schema, which is not in the API's
  exposed schemas, so they are not remotely callable regardless of grants.

So this lint is largely conservative, not a live hole. Optional defense-in-depth,
not urgent:

1. `REVOKE EXECUTE ... FROM authenticated, anon` on trigger-only functions
   (`touch_updated_at`, the baseline-recompute trigger fn, the coach-conversation
   trim, the beta throttle helpers) — they should only fire from triggers.
2. Confirm in Supabase/Lovable API settings that `private` is not among the
   exposed schemas.
3. As part of the future domain work, re-audit any new `SECURITY DEFINER`
   function: it must either authorize the caller internally or not be reachable
   from the exposed schema.
