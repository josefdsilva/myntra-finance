-- Phase 3: richer plan recurrence. Allow quarterly and semiannual repeats
-- alongside the existing one-off / monthly (ongoing) / yearly (annual) options.
-- All repeating recurrences are perpetual — they simply recur from their start
-- month onward with no end date.

ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_recurrence_check;

ALTER TABLE public.plans
  ADD CONSTRAINT plans_recurrence_check
  CHECK (recurrence IN ('one_off', 'monthly', 'quarterly', 'semiannual', 'annual', 'ongoing'));
