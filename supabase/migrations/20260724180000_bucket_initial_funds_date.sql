-- A project's "initial funds" is a one-time seed (what it already held when you
-- started tracking it), NOT a live balance — the current balance is that seed
-- plus every contribution since. Add an as-of date so the seed is clearly
-- anchored to a moment in time. The existing initial_balance column stays as the
-- amount (relabelled "Initial funds" in the UI); this only adds the date.
ALTER TABLE public.buckets
  ADD COLUMN IF NOT EXISTS initial_funds_date date;
