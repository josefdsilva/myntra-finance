-- Cadence foundation (Phase 1 of Payables & Receivables).
--
-- Each recurring income and fixed cost gains a native cadence (how often it
-- actually occurs) plus the native amount at that cadence. monthly_amount stays
-- the canonical monthly-equivalent that every downstream calc already reads
-- (baseline_budget, surplus, safe-to-spend), so nothing else has to change.
--
-- Recurring lines are perpetual by design: there is no end date. A weekly wage
-- or a yearly rent simply repeats indefinitely until the user removes it.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'incomes' AND column_name = 'cadence'
  ) THEN
    ALTER TABLE public.incomes
      ADD COLUMN cadence text NOT NULL DEFAULT 'monthly'
        CHECK (cadence IN ('weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly')),
      ADD COLUMN native_amount numeric;
    UPDATE public.incomes SET native_amount = monthly_amount WHERE native_amount IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fixed_expenses' AND column_name = 'cadence'
  ) THEN
    ALTER TABLE public.fixed_expenses
      ADD COLUMN cadence text NOT NULL DEFAULT 'monthly'
        CHECK (cadence IN ('weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly')),
      ADD COLUMN native_amount numeric;
    UPDATE public.fixed_expenses SET native_amount = monthly_amount WHERE native_amount IS NULL;
  END IF;
END $$;
