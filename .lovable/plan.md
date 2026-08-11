# Engagement plan: the first 30 days after signup

bynku already has the pieces (journey, coach, achievements, cycle metrics, push, weekly digest). What's
missing is a loop that makes a user come back on a random Tuesday. This plan wires the existing pieces
into one habit: **one small action per visit, visible progress every week.**

## 1. Day 0-1: reach "first useful number" fast

The activation moment is seeing a real "What's left" figure, not finishing setup.

- Onboarding ends by showing the number it just computed, with one next action attached.
- Setup checklist becomes 3 steps, not a list of everything: income, fixed costs, first expense. The
  rest moves into the coach as later nudges.
- Skip-friendly: any missing input renders as an inline "add this to sharpen the number" chip on the
  dashboard instead of blocking.

## 2. Every visit: exactly one next action

- A single "Today" card at the top of the dashboard: one action, one tap, dismissable. Sourced from the
  existing coach signals, ranked so only the highest-value one shows.
- Rules of the ranking: overspend risk > missing data that breaks a number > an unallocated surplus >
  a stalled project > a journey stage one step from done > nothing (show a calm "you're on track").
- Never more than one; the tips list stays below as secondary.

## 3. Weekly rhythm: the cycle review

- A short cycle-end review screen (3 screens max): what you spent vs estimate, what you set aside,
  one thing to change next cycle. Ends with a single confirm that rolls estimates forward.
- Tie the weekly digest email/push to it: the digest becomes the invitation to the review, not a
  standalone report.
- Log each completed review as a streak; the streak is the one number we celebrate.

## 4. Proof of progress

- A compact "since you started" strip: cycles reviewed, money set aside, debt reduced, journey level.
  Numbers only from data already computed (cycle_metrics, allocations, debts, journey).
- Achievements fire on real milestones (first full cycle, first €500 set aside, first loan overpayment,
  3-cycle streak) and are surfaced in the coach inbox plus a small toast, never a modal.
- The shareable snapshot is offered right after a milestone — that is when someone actually wants to
  share it.

## 5. Bringing people back (notifications that earn their place)

- Three push/email moments only: cycle start (plan), mid-cycle (drift warning, only if drifting),
  cycle end (review). Everything else stays in-app.
- Every notification names a number and links to one screen. If we can't name a number, we don't send.
- Quiet by default for anything else; existing notification prefs stay authoritative.

## 6. Reduce the cost of logging

Engagement dies on data entry, so the daily loop has to be cheap:

- Quick-add opens with three fields (amount, category, date) and an "Add details" toggle.
- Recurring-expense settlement becomes one tap from the dashboard ("Rent paid?") instead of a form.
- Photo/voice capture surfaced on the dashboard, not only inside the expenses page.

## Sequencing

1. Today card + ranking (highest impact, uses existing signals)
2. Quick-add slimming + one-tap settlement
3. Cycle review screen + streak
4. Progress strip + milestone achievements
5. Notification trimming to the three moments

## Technical notes

- Today card: new small component on `dashboard.tsx`, ranking function next to `src/lib/coach-signals.ts`
  (pure, unit-testable). No new tables.
- Streak + review completion: one new table (`cycle_reviews`: household_id, cycle_start, completed_at)
  with GRANTs and household-scoped RLS.
- Milestones reuse `src/lib/achievements.functions.ts`; add the new kinds there.
- Notification trimming happens in `src/lib/coach-runner.server.ts` (which nudges set `push`/`email`),
  not in new endpoints.
- All copy goes through `src/lib/i18n-entries.ts` for every locale.

## Out of scope

- Gamification for its own sake (points, badges walls, leaderboards).
- Any daily-streak mechanic that punishes a missed day; the cycle is the unit, not the day.
- New AI surfaces — this plan spends no extra credits per user.
