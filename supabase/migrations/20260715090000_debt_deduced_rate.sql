-- Deduced rate: the annual effective rate solved from principal + monthly + maturity.
-- The user-entered taeg_pct stays as their (estimated) all-in rate; deduced_rate_pct
-- is what the app uses for the actual schedule, so the inputs can't disagree.
ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS deduced_rate_pct NUMERIC(8,4);
