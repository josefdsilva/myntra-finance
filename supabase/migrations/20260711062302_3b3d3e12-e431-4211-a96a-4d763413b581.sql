
CREATE TABLE public.debts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other',
  monthly_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  taeg_pct NUMERIC(6,3),
  principal_remaining NUMERIC(14,2),
  maturity_date DATE,
  note TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.debts TO authenticated;
GRANT ALL ON public.debts TO service_role;

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view household debts"
  ON public.debts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.household_members m WHERE m.household_id = debts.household_id AND m.user_id = auth.uid()));

CREATE POLICY "Members can insert household debts"
  ON public.debts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.household_members m WHERE m.household_id = debts.household_id AND m.user_id = auth.uid()));

CREATE POLICY "Members can update household debts"
  ON public.debts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.household_members m WHERE m.household_id = debts.household_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.household_members m WHERE m.household_id = debts.household_id AND m.user_id = auth.uid()));

CREATE POLICY "Members can delete household debts"
  ON public.debts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.household_members m WHERE m.household_id = debts.household_id AND m.user_id = auth.uid()));

CREATE INDEX debts_household_idx ON public.debts(household_id);

CREATE TRIGGER debts_touch_updated_at
  BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
