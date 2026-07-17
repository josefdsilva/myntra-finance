# bynku backlog

A living list of what we can still build together. Grouped by type, roughly ordered by priority within each group. Last updated: 2026-07-17.

## Run before the beta opens

These are already written and just need to be applied to the database.

- Apply migration `20260716160000_beta_codes_seats.sql` (seat limits + throttling).
- Apply migration `20260717120000_secdef_hardening.sql` (pins search_path, revokes PUBLIC/anon on definer functions).
- Apply migration `20260717140000_scheduled_debt_payments.sql` (monthly debt-payment log).
- Create a beta code, for example: `INSERT INTO public.beta_codes (code, label, max_seats) VALUES ('SPRING-2026','Round 1',20);`
- Reset seat counting if needed: `DELETE FROM public.beta_members; DELETE FROM public.beta_redeem_attempts;`
- Run `bun test` and a production build to typecheck the latest changes end to end.

## Parked, needs your decision

- Per-household encryption. Full plan lives in `docs/household-encryption-plan.md`. It is the biggest change in the app. Four decisions to confirm before building: encrypt amounts only or also notes/merchant names; keep scheduled emails as device-triggered or turn them off for encrypted households; require the recovery code at setup or make it optional; confirm the easy-word plus Argon2id balance.
- Notifications under encryption. Encrypted households cannot have a server read amounts for scheduled digests or overspend alerts, so those become device-triggered or generic. Decide the trade-off alongside the encryption go/no-go.

## Ready to build

- Net worth over time. A simple chart of assets (project balances) minus debts across cycles. Most of the data already exists.
- Global movements ledger. `fetchMovements` exists but nothing renders a full history yet. Debt payments are now visible per loan, but a single account-activity view (deposits, withdrawals, transfers, debt payments) would tie it together.
- Recurring templates. Let users save a set of fixed expenses or allocations and reapply them, to speed up onboarding and monthly setup.
- Backfill scheduled debt payments. Today we log the current cycle forward only. Optionally reconstruct past monthly payment entries for a loan with a historical start date, so the ledger matches the projection from day one.
- Statement import friendly errors. Apply the same human-error treatment we did for photo/voice/AI capture to the statement importer.

## Localization and content

- Translate the wiki glossary. Some wiki entries are still English-only. Translate into pt, es, de, fr.
- i18n parity check. Add an automated check (test or lint) that every `MessageKey` exists in all five locales and flags duplicates, so drift is caught in CI instead of by hand.
- Align mobile landing copy. Make sure the shorter mobile hero and feature copy match the rewritten desktop landing.

## Code health and performance

- Bundle and lazy-load audit. Split heavier routes and defer non-critical libraries to cut first-load size.
- Multi-currency label cleanup. A few Settings labels still hardcode the euro sign. Drive every currency symbol from the household setting.
- Beta S3 verification. Confirm RLS coverage with a quick cross-household read test after the hardening migration is applied.

## Recently shipped, for reference

- Money-math unit tests (cycle, movements, debt schedule) and a `bun test` script.
- Removed the client-side baseline computation in Settings so the database trigger is the single source of truth.
- Debt origination: loan start date, original amount, optional balance-today override, live estimated-balance preview, and anchor logic that reconstructs past progress.
- Scheduled monthly debt-payment log entries, dated on the maturity date's day of the month, with a per-loan payment history.
- Beta code gate with seat limits and throttling.
- Currency support for euro, dollar, and pound.
- Coach fixes: emergency-fund coverage counts seeded project funds, and a realized savings rate with potential as commentary.
- Friendlier capture error messages and a rewritten pre-login landing page.
