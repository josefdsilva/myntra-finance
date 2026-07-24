-- Cycle configuration per space.
--
-- Two modes:
--   'event' — variable-length, payday-driven. The cycle is anchored to a chosen
--             income (a salary); marking that income received rolls the cycle.
--             This is what households already do via is_salary receipts.
--   'time'  — fixed-length, calendar-driven. The cycle is the space's `cycle`
--             length (weekly/monthly/quarterly/yearly) counted from an anchor
--             date, so a firm can run a non-calendar fiscal year (e.g. Apr 1).
--
-- Defaults reproduce today's behaviour: personal spaces stay event/payday-driven,
-- businesses move to time-driven fiscal periods (their `cycle`, already
-- defaulted to quarterly). Nothing consumes these columns yet, so this migration
-- changes no behaviour on its own.

ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS cycle_mode text NOT NULL DEFAULT 'event'
    CHECK (cycle_mode IN ('event', 'time')),
  -- The income whose receipts drive an event cycle. NULL = use the primary/
  -- first salary automatically.
  ADD COLUMN IF NOT EXISTS cycle_anchor_income_id uuid
    REFERENCES public.incomes(id) ON DELETE SET NULL,
  -- Reference date a time cycle's periods are counted from (the fiscal start).
  -- NULL = plain calendar (Jan 1 / month 1st / Mondays).
  ADD COLUMN IF NOT EXISTS cycle_anchor_date date;

-- Businesses default to time-driven fiscal periods.
UPDATE public.households SET cycle_mode = 'time' WHERE kind = 'business';
