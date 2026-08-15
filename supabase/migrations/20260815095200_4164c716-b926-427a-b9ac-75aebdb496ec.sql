CREATE TABLE public.savings_commitments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  category text NOT NULL,
  monthly_target numeric NOT NULL,
  baseline_monthly numeric NOT NULL,
  cycle_start date NOT NULL,
  status text NOT NULL DEFAULT 'active',
  resolved_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX savings_commitments_active_unique
  ON public.savings_commitments (household_id, category, cycle_start)
  WHERE status = 'active';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_commitments TO authenticated;
GRANT ALL ON public.savings_commitments TO service_role;

ALTER TABLE public.savings_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view household savings commitments"
  ON public.savings_commitments FOR SELECT TO authenticated
  USING (private.is_household_member(household_id, auth.uid()));

CREATE POLICY "Members insert household savings commitments"
  ON public.savings_commitments FOR INSERT TO authenticated
  WITH CHECK (private.is_household_member(household_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Members update household savings commitments"
  ON public.savings_commitments FOR UPDATE TO authenticated
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Members delete household savings commitments"
  ON public.savings_commitments FOR DELETE TO authenticated
  USING (private.is_household_member(household_id, auth.uid()));

CREATE TRIGGER savings_commitments_touch
  BEFORE UPDATE ON public.savings_commitments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();