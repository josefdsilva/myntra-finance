# Journey-first, values-driven bynku

Make bynku feel less like a live-budgeting dashboard and more like a human-centred guide that households check weekly or monthly. The work keeps the current navigation (no nav surgery) and focuses on three levers: a values-first onboarding, a stellar bank-statement fast lane, and a coach that nudges users based on their chosen update rhythm.

## Decisions from the choices

- App structure: keep today's navigation; add a chat entry point rather than a second mode.
- Values: ask "what 3 things do you value?" as the first step of onboarding, and let users edit it later in Settings.
- Data entry: statement-first. The bank-statement import becomes the primary way to catch up; chat starts by guiding that import and answering questions.
- Staleness: users pick their rhythm in Settings (weekly / biweekly / per cycle), weekly by default; bynku nudges only at that interval.

## Implementation

### 1. Household values

Add a `values` column to `public.households` (JSONB, default `{}`). Store up to three ranked values chosen from a curated list plus a free-text option.

Curated options (localized): family time, travel, health & wellbeing, home, giving/donations, learning/career, freedom/security, fun/little treats, environment, other.

- Onboarding step: rendered before country/household size. One screen: "What 3 things matter most to your household?" Pick up to 3 chips; optional free-text fourth item. Skippable with a "Decide later" button.
- Settings section: editable chip list; changing values regenerates the journey copy and default project suggestions.
- Privacy: values are household data, covered by existing RLS; no sharing.

### 2. Values shape the journey and defaults

Use the stored values to personalise the app without removing user control.

- Journey stages: when values change, rewrite stage titles and objective copy via the existing `journey_stages` table. A travel-heavy household sees "Build your travel fund" instead of generic "Invest". Health-heavy households see "Health safety net" earlier.
- Default projects (buckets): seed values-aligned starter buckets on household creation. Travel → "Holidays"; family → "Family time"; giving → "Donations"; home → "Home improvements"; health → "Health buffer". Existing buckets remain editable.
- Category intent defaults: map value tags to intent levels. Travel → "important"; fun/little treats → "nice-to-have"; health → "essential". Applied only to newly categorised expenses; never retroactively overwrite user choices.
- Coach prompt: feed values into `coach.functions.ts` system prompt so the coach references them ("Your surplus this month could cover a trip — that's one of your top values").

### 3. Statement-first fast lane

Make the bank-statement import the obvious way to catch up after a week or month of not opening bynku.

- Promote the import on the Dashboard when no expense has been added in the user's chosen cadence. Card copy: "Catch up in one go — upload your bank statement".
- Improve the review step in `statement-import-flow.tsx`:
  - Auto-split detected recurring items into fixed vs variable with confidence scores.
  - Surface income rows separately and suggest marking salary/rent/etc.
  - Let the user confirm all rows in one click or edit individual rows inline.
  - Add a "Remember these choices for next month" toggle that learns category mappings per merchant.
- Add a coach message triggered on first import: explain what was created (fixed expenses, variable estimate, income) in one short paragraph.
- Allow statement import from the chat composer via a paper-clip / "Upload statement" quick action.

### 4. Update cadence and staleness nudges

Add `update_cadence` to `public.households` (`'weekly' | 'biweekly' | 'per_cycle'`, default `'weekly'`).

- Settings section: radio group under Notifications. Label: "How often do you plan to update bynku?"
- Staleness check: a lightweight server function reads the latest `expenses.occurred_at` (or statement import date) per household. If older than the cadence, surface a coach tip and a dashboard card: "It's been X days — upload a statement or tell me what's changed."
- No push/email yet; start with in-app coach nudges only.

### 5. Coach chat entry point

Add a persistent floating chat button (bottom-right on desktop, bottom-center on mobile) that opens the existing coach conversation.

- Quick actions inside the chat empty state: "Upload statement", "What's my safe-to-spend?", "Add an expense", "Show my journey".
- The coach can already answer questions; in this pass, teach it to hand off to the statement import flow when the user mentions bank statements, CSVs, catching up, or many transactions.
- Keep the existing CoachDock/CoachInbox behaviour unchanged for now.

### 6. Keep navigation unchanged

No new top-level routes and no "Advanced" toggle. The current nav already groups analytical screens under "Advanced". This plan only adds values editing inside Settings and the floating chat button.

## Technical details

- Database migration:
  - `ALTER TABLE public.households ADD COLUMN values jsonb DEFAULT '{}'::jsonb;`
  - `ALTER TABLE public.households ADD COLUMN update_cadence text DEFAULT 'weekly';`
  - GRANTs and RLS unchanged (households already has RLS).
- Update `src/integrations/supabase/types.ts` after migration.
- `src/routes/_authenticated/onboarding.tsx`: insert a new `values` step at index 0, persist to household row, and skip if already set.
- `src/routes/_authenticated/settings.tsx`: add Values section and Update cadence section.
- `src/lib/household.functions.ts`: extend `updateHousehold` schema to accept `values` and `update_cadence`.
- `src/lib/journey.functions.ts`: add `regenerateJourneyForValues` server function that rewrites `template_key`/`title`/`objective` on existing seed stages without touching custom user stages.
- `src/lib/household.functions.ts`: use values in `defaultBucketsFor` when seeding a new household.
- `src/lib/intent.ts`: add `defaultIntentForValueTag` helper; use in statement import and quick-add when a category is first seen.
- `src/lib/coach.functions.ts`: include values in the system prompt context.
- `src/components/statement-import-flow.tsx`: add merchant→category learning via a new `merchant_category_hints` table or localStorage fallback.
- `src/components/floating-coach.tsx` (new): wraps `CoachDock`/`CoachInbox` with a floating trigger.
- `src/routes/_authenticated/dashboard.tsx`: add staleness card and statement CTA.
- Localisation: add keys to `src/lib/i18n-entries.ts` for all new UI copy.

## Out of scope for this plan

- Removing more features (the nav is already minimal).
- Chat-based creation of expenses/debts/projects (statement-first is the priority).
- Push/email notifications.
- Open-banking reconnection.

## Success check

- New onboarding completes with values stored and visible in Settings.
- A new household with "travel" as a top value sees a "Holidays" project and travel-friendly journey copy.
- Dashboard shows the statement CTA when no expense has been added for the chosen cadence.
- Typecheck clean and existing tests pass.