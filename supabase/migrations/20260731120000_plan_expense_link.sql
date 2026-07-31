-- Link a resolved plan to the expense it optionally generated. This lets the
-- budget math count the payment exactly once: when a plan has an expense_id, the
-- expense already reflects the outflow, so leftoverObligation() must NOT also
-- subtract the plan (see src/lib/plan.ts). ON DELETE SET NULL means deleting the
-- expense simply re-exposes the plan as an unexpensed obligation again.
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS plans_expense_id_idx ON public.plans(expense_id);
