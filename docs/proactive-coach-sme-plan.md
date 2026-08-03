# Proactive coach + SME runway/receivables — implementation plan

Two features on one shared spine. The proactive coach turns bynku from "answers
when asked" into "tells you the one thing worth doing." The SME track adds cash
runway and receivables early-warning for businesses. Both ride the same delivery
rails and the same in-app inbox.

## What already exists (reuse, do not rebuild)

- Web push: `push.functions.ts`, `webpush.server.ts`, `push_subscriptions`,
  `notification-settings.tsx`.
- Email: `enqueueTemplateEmail` (`email/send.server`), transactional routes.
- Preference store: `notification_prefs` (`weekly_digest`, `baseline_warn`,
  `emergency_warn`, per `user_id`).
- Idempotency: `notification_log` (unique `user_id` + `payload_hash`).
- Cron hooks: `weekly-digest` (Mon 08:00), `budget-alerts`, `cycle-start`.
- Grounded facts: `coach.functions.ts`, `cycle-metrics`, `cycle-report`,
  `health-score` (business runway = reserve / monthly outgoings), Plans engine.

The gaps: everything is household-only and spend-recap oriented; there is no
persistent in-app surface (push is fleeting); nothing is business-aware; no
runway or receivables logic feeds alerts.

## Delivery model (per the chosen scope)

The **in-app coach inbox is the default home** for every nudge. Web push and
email are **opt-in amplifiers** toggled in Settings. One funnel enforces this:

`emitCoachMessage(sb, msg)` →
1. Always upsert a row in `coach_messages` (idempotent on `dedupe_key`).
2. If the user has `push_enabled` and a device → send web push.
3. If the user has `email_enabled` → enqueue the email template.

This replaces the ad-hoc push calls in the existing hooks with a single path, so
the inbox is always the source of truth and channels never diverge.

## Phase 1 — Inbox foundation (shared)

- Migration `coach_messages`: `id`, `household_id`, `user_id` (null = whole
  household), `kind`, `severity` (info/success/warn/critical), `title`, `body`,
  `action_label`, `action_url`, `data jsonb`, `cycle_start` (nullable),
  `dedupe_key` (unique per household), `read_at`, `created_at`. RLS: household
  members read + mark-read; service role inserts.
- Extend `notification_prefs` with `push_enabled` (default true) and
  `email_enabled` (default false) master toggles.
- `emitCoachMessage` server helper (the funnel above) + `coach-messages.functions.ts`
  (list, unread count, mark read / mark all read).
- In-app inbox UI: a bell with unread badge in the app shell, opening a panel of
  messages (severity dot, title, body, action button). Marks read on open.
- Settings: add master Email + Push toggles alongside the existing category rows.

## Phase 2 — Household proactive signals

Pure module `coach-signals.ts` returns a prioritised list of candidate messages
from grounded facts; deterministic and unit-tested. AI only phrases the "one
action" line (cheap, optional). Triggers:

- **End-of-cycle recap + one action** — on cycle rollover (and a daily catch-up
  cron): recap of the closed cycle from `cycle-metrics`/`cycle-report` plus the
  single highest-impact next step (e.g. "move the €240 surplus to your emergency
  fund, you are 0.6 months short of target").
- **Mid-cycle drift** — upgrade `budget-alerts` to emit via the funnel with
  coach-grade copy (pace vs pool, estimate drift from calibration).
- **Upcoming cost reminders** — daily scan of Plans due within N days that are
  unfunded/unresolved (car service, tax, annual bills) → "set aside €X now".
- **Milestones & wins** — emergency-fund target reached, savings streak, score
  improvement (from `cycle-metrics`), celebrated once.

## Phase 3 — SME runway + receivables engines

- `runway.ts`: `cashOnHand / monthlyNetBurn` → months of runway, reusing the
  health-score reserve/outgoings basis. Cash on hand = **computed** (cash &
  liquid assets + savings buckets) with an optional **manual override**.
  Migration: `households.cash_on_hand_override` (numeric null) +
  `cash_on_hand_override_at`.
- `receivables.ts`: from unresolved money-in Plans (and issued invoices where
  present) → aging buckets (not due, 0-30, 31-60, 61-90, 90+), totals, overdue
  list. Leak-safe internals.
- Both unit-tested. A "Runway & receivables" card on the business dashboard:
  runway months, editable cash on hand, monthly burn, aging table, overdue list.

## Phase 4 — SME early-warning alerts

Daily business scan hook emits via the funnel, idempotent per threshold/period:

- **Runway warning** at 3 / 2 / 1 months and when a due receivable would tip it
  below a month ("if this invoice slips 30 days you dip under 1 month on the 14th").
- **Receivable due/overdue** reminders with a one-tap drafted follow-up message
  the owner can copy or send (actual auto-send is a later step).

## Phase 5 — i18n + wiki + verification

Five-locale strings for inbox, settings toggles, signal copy and the SME card;
a wiki section explaining the coach and runway; parity + type checks; a subagent
review of the signal rules and idempotency.

## Guardrails

- Ratio-based, no leaking of raw amounts on shareable surfaces; euro figures stay
  inside the owner's private inbox/dashboard.
- Every emit is idempotent (dedupe_key) so a re-run never double-notifies.
- The coach recommends principles and actions, never products.
