-- Allow an invoice/receipt to be attached to a fixed-cost settlement (the
-- payables checklist), not just to an expense or a plan. Businesses keep proof
-- of payment alongside each settled cost.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS settlement_id uuid
    REFERENCES public.fixed_expense_settlements(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS invoices_settlement_idx
  ON public.invoices(settlement_id)
  WHERE settlement_id IS NOT NULL;

-- Broaden the "must target something" check to include settlements.
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_target_chk;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_target_chk
  CHECK (expense_id IS NOT NULL OR plan_id IS NOT NULL OR settlement_id IS NOT NULL);
