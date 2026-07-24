-- Payables checklist: which recurring fixed costs have actually been settled in
-- a given cycle. This is a pure tracking overlay for businesses ("what's still
-- outstanding this quarter") — it deliberately does NOT feed the baseline or
-- "actual out", which keep treating fixed costs as assumptions (so nothing is
-- double-counted). One row per settlement; the cycle a settlement belongs to is
-- derived at read time from occurred_at against the space's cycle bounds.
CREATE TABLE public.fixed_expense_settlements (
  id                UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id      UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  fixed_expense_id  UUID NOT NULL REFERENCES public.fixed_expenses(id) ON DELETE CASCADE,
  amount            NUMERIC NOT NULL DEFAULT 0,
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX fixed_expense_settlements_hh_idx
  ON public.fixed_expense_settlements(household_id);
CREATE INDEX fixed_expense_settlements_cost_idx
  ON public.fixed_expense_settlements(fixed_expense_id);
CREATE INDEX fixed_expense_settlements_occurred_idx
  ON public.fixed_expense_settlements(occurred_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_expense_settlements TO authenticated;
GRANT ALL ON public.fixed_expense_settlements TO service_role;

ALTER TABLE public.fixed_expense_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage fixed expense settlements"
  ON public.fixed_expense_settlements FOR ALL TO authenticated
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));
