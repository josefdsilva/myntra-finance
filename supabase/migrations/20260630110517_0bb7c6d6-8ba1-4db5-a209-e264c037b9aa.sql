CREATE TABLE public.bucket_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  bucket_id UUID NOT NULL REFERENCES public.buckets(id) ON DELETE CASCADE,
  period DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  note TEXT,
  confirmed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, bucket_id, period)
);

CREATE INDEX bucket_allocations_hh_period_idx ON public.bucket_allocations(household_id, period DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bucket_allocations TO authenticated;
GRANT ALL ON public.bucket_allocations TO service_role;

ALTER TABLE public.bucket_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage allocations"
  ON public.bucket_allocations FOR ALL TO authenticated
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

CREATE TRIGGER bucket_allocations_touch_updated_at
  BEFORE UPDATE ON public.bucket_allocations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
