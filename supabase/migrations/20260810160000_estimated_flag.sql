-- Estimate marker for onboarding presets. Rows generated from national
-- benchmark averages start flagged; confirming/editing a row clears it, and the
-- dashboard nudges the user to sharpen the estimates. See docs/faster-setup.md.

ALTER TABLE public.fixed_expenses
  ADD COLUMN IF NOT EXISTS is_estimated BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.variable_estimates
  ADD COLUMN IF NOT EXISTS is_estimated BOOLEAN NOT NULL DEFAULT false;
