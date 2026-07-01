CREATE TABLE public.variable_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  category TEXT,
  monthly_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX variable_estimates_household_idx ON public.variable_estimates(household_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.variable_estimates TO authenticated;
GRANT ALL ON public.variable_estimates TO service_role;
ALTER TABLE public.variable_estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage variable estimates"
  ON public.variable_estimates FOR ALL TO authenticated
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));
CREATE TRIGGER trg_variable_estimates_updated BEFORE UPDATE ON public.variable_estimates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();