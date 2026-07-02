
CREATE TABLE public.analysis_overviews (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  cycle_start date NOT NULL,
  content text NOT NULL,
  model text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, cycle_start)
);

GRANT SELECT ON public.analysis_overviews TO authenticated;
GRANT ALL ON public.analysis_overviews TO service_role;

ALTER TABLE public.analysis_overviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can read overviews"
  ON public.analysis_overviews FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = analysis_overviews.household_id
      AND hm.user_id = auth.uid()
  ));
