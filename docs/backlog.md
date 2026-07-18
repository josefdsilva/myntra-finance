# bynku backlog

A living list of what we can still build together. Grouped by type, roughly ordered by priority within each group. Last updated: 2026-07-18.

## Parked, needs your decision

- Per-household encryption. Full plan lives in `docs/household-encryption-plan.md`. It is the biggest change in the app. Four decisions to confirm before building: encrypt amounts only or also notes/merchant names; keep scheduled emails as device-triggered or turn them off for encrypted households; require the recovery code at setup or make it optional; confirm the easy-word plus Argon2id balance.
- Notifications under encryption. Encrypted households cannot have a server read amounts for scheduled digests or overspend alerts, so those become device-triggered or generic. Decide the trade-off alongside the encryption go/no-go.

## Ready to build

- Subscription radar. Detect recurring charges from transaction history (same merchant, similar amount, monthly or yearly cadence) and surface them in one place, so users can spot forgotten or creeping subscriptions and decide what to cut. Flag new ones and price increases.
- Things you own (net worth prerequisite). The app maps what you owe (debts) and money in your projects, but nothing you own, so a net worth number would look far too low (a 250K mortgage shows, but the 370K house behind it does not). Add a simple "things you own" list in Settings, in plain language and no jargon: each item has a name, a rough current value, an optional type (home, vehicle, other), and an optional link to a debt. Linking a house to its mortgage lets the app also show equity (370K owned minus 250K owed = 120K). The headline becomes: what you own, plus money in your projects, minus what you still owe.
- Net worth over time. Builds on "things you own". Debt balances and project balances can be reconstructed across past cycles automatically (amortization plus allocations), but an owned item's value has no history unless the user provides it. Decision made: let users log dated valuations (for example once a year) and draw the line following those points, so the curve reflects real changes in what a home or car is worth. When only one valuation exists, hold it flat and note that. The chart then shows net worth trending up as debt is paid down, savings grow, and valuations are updated.
- Real estate module (validate with beta first). A richer, property-specific version of "things you own". Let a household map every property it owns, connect each one to its mortgage, and record a market value. Then use online market indicators (regional house-price indices) to keep a projected current value updated over time automatically, so the user does not have to re-estimate by hand between manual valuations. This feeds net worth directly: property value minus mortgage owed is equity, and the index trend gives the over-time line a real basis rather than a flat hold. Open questions to settle before building: which price index per country or region, its licensing and cost, and how to blend the index trend with the user's own purchase price and manual valuations. Note: hold this until beta testers say what they actually miss, so the feature is shaped by real demand rather than guessed at.
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

## Known weaknesses and risks (revisit when beta demand justifies)

Guiding principle: these are deferred on purpose. Build them in response to real user and beta demand, not speculatively. Captured here so nothing is forgotten, but there is no point doing this work until there are users and they ask for it.

- Manual entry kills adherence (the biggest risk). Everything depends on the user logging expenses, confirming allocations and resolving plans; there is no bank sync, so if data entry stops the numbers drift from reality. The fix is an open-banking / bank-feed integration through a licensed aggregator (PSD2 account information; TrueLayer, Tink, GoCardless/Nordigen). The aggregator carries the banking licence and strong authentication, the app never touches credentials, and access is read-only. The plumbing is a few weeks; the real work is the consent lifecycle (roughly 90-day re-auth), per-connection cost, per-country bank coverage, and reconciliation into the model. Intended for a later stage, gated on beta demand.
- No single money ledger. Baseline (trigger-derived), allocations, account_movements, plans and the amortization projection are parallel tracks kept in sync by hand, which is where subtle bugs come from (burndown double-counts, plan-payment tagging, funded-plan edge cases). One authoritative money-in / money-out ledger would cut the drift and is close to a prerequisite for a live bank feed.
- Conceptual load for the audience. Baseline, surplus, real surplus, variable pool, safe-to-spend, leftover, sinking funds, three project types, plans and cycles is a lot of vocabulary for less financially literate users. Worth a simplification / progressive-disclosure pass (hide advanced concepts until needed) once betas show where they get lost.
- Privacy and encryption is an open trade-off, not a promise. Nothing has been promised to anyone; it is being weighed. Early beta conversations do not flag privacy as a concern, so for now the app keeps full features and plaintext storage rather than complicating things. The full per-household encryption plan sits in `docs/household-encryption-plan.md` for if and when demand appears. Note that a bank feed (above) would raise the stakes and could tip this from optional to worthwhile.
- Verification is thin outside the pure engines. The core math is unit-tested, but server functions, RLS and the UI / integration layer are not, and there is no end-to-end coverage. Money accuracy is exactly where regressions hurt most. Add integration and E2E tests plus an RLS cross-household test as usage grows.
- AI cost and reliability are load-bearing. Statement import sends whole files to the model each time; the coach, tips and cycle reports also use AI. Costs scale with use and long statements can truncate. Watch credit spend, keep graceful fallbacks, and consider caching or cheaper paths if volume grows.
- Projections can look more certain than they are. The forecast charts and the plan timeline assume every target is met and every debt runs to schedule. Consider softer framing (ranges, "if you keep this up") so the lines are not read as guarantees.
- Localization and currency are half-finished. The coach and cycle-report prompts hardcode EUR and "Portugal", benchmarks are EU-only, and onboarding is English-only. The tactical pieces are already listed under Localization and Code health above; finish these before expanding beyond the initial market.

## Recently shipped, for reference

- Plans documented and onboarded. A "Planning ahead" wiki section (purpose, how it works, what happens when a payable or receivable comes due) in all five languages, and a skippable "anything coming up?" step in the onboarding wizard.
- Plan visuals. A Gantt-style timeline (3/6/12 month toggle) showing each plan and its funding runway, and a multi-series forecast chart with toggleable lines: the projected balance of every project (including sinking funds), each debt's paydown, income, surplus, cumulative interest saved, and accumulated uninvested surplus. Pure projection engine with tests.
- Plans wired into AI and insights. The coach is grounded on a 6-month plan forecast, upcoming plans, and recently resolved plans, so it gives informed answers about future saving and windfalls. The dashboard tips flag a tight month ahead and suggest pre-funding a big unfunded one-off. The cycle report now folds in plans resolved that cycle (estimate vs actual) and a "Looking ahead" section for the next cycle.
- Forward planning. A Plan page where users line up known future costs and income changes (one-off, annual, or ongoing-from), see a month-by-month forecast of income, baseline, planned spend, and leftover with shortfall months flagged, and turn any big one-off into a savings project in one click. The standing baseline stays recurring-only; the current cycle's real surplus on the dashboard now subtracts this month's unfunded plans. Pure forecast engine with unit tests.
- Planned vs reality. Plan entries are fully editable (value and date), and each can be resolved against reality: mark it done, enter what it actually cost (or that it did not happen), and choose where it is paid from — the month's unallocated leftover (spilling into the everyday budget only if it exceeds the leftover) or a specific project / emergency fund (withdrawn from that pot). Paying from a project is tagged so it does not distort "allocated this cycle" or the savings rate. A done history shows estimate vs actual with a better/worse badge; resolved plans stay counted for their month so paid money does not reappear.
- AI-read bank statements. The importer now sends the whole file (CSV or PDF) to the AI, which extracts clean signed transactions across any bank layout; the existing recurring / variable / income / debt analysis runs on top. CSV keeps a local-parser fallback if the AI is unavailable.
- Money-math unit tests (cycle, movements, debt schedule) and a `bun test` script.
- Removed the client-side baseline computation in Settings so the database trigger is the single source of truth.
- Debt origination: loan start date, original amount, optional balance-today override, live estimated-balance preview, and anchor logic that reconstructs past progress.
- Scheduled monthly debt-payment log entries, dated on the maturity date's day of the month, with a per-loan payment history.
- Beta code gate with seat limits and throttling.
- Currency support for euro, dollar, and pound.
- Coach fixes: emergency-fund coverage counts seeded project funds, and a realized savings rate with potential as commentary.
- Friendlier capture error messages and a rewritten pre-login landing page.
