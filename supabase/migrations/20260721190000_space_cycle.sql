-- Space-level budgeting/reporting cycle. Aggregate figures (net in/out, section
-- totals) are expressed in this period. Individuals typically run weekly or
-- monthly cycles; firms often report quarterly or yearly. Per-line amounts keep
-- their own cadence — the cycle only governs how the roll-ups are presented.
--
-- monthly_amount elsewhere stays the canonical monthly-equivalent; the cycle is
-- purely a display/rollup factor, so no other math changes.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'households' AND column_name = 'cycle'
  ) THEN
    ALTER TABLE public.households
      ADD COLUMN cycle text NOT NULL DEFAULT 'monthly'
        CHECK (cycle IN ('weekly', 'monthly', 'quarterly', 'yearly'));
    -- Smart default: existing businesses report quarterly.
    UPDATE public.households SET cycle = 'quarterly' WHERE kind = 'business';
  END IF;
END $$;
