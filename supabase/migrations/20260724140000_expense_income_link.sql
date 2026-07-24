-- Link a receipt back to the recurring income it fulfils. When "mark received"
-- is used on a recurring income, the resulting income expense carries the
-- income_id so a cycle can tell which expected inflows have actually arrived.
-- Nullable: ad-hoc money-in and legacy salary receipts have no linked income.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS income_id uuid
    REFERENCES public.incomes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS expenses_income_id_idx
  ON public.expenses (income_id)
  WHERE income_id IS NOT NULL;
