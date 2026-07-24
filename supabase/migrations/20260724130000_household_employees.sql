-- Company head-count for business spaces. Personal spaces keep using
-- adults/children (household size for national benchmarks); businesses capture
-- an employee count instead. Nullable/zero-default so existing rows are fine.
ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS employees integer NOT NULL DEFAULT 0
    CHECK (employees >= 0);
