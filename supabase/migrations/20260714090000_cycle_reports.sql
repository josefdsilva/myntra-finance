-- Cache for the AI-generated narrative half of a closed-cycle report ("what went
-- well" / "areas to improve"). Keyed by the closed cycle's start date, which is
-- immutable once that cycle has ended, so unlike analysis_overviews there is no
-- TTL — content is only regenerated when the user explicitly asks for a refresh.
-- The deterministic stats/suggestions half of the report is always recomputed
-- live from expenses/estimates/buckets, not stored here.
CREATE TABLE public.cycle_reports (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  cycle_start date NOT NULL,
  narrative text NOT NULL,
  model text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, cycle_start)
);

GRANT SELECT ON public.cycle_reports TO authenticated;
GRANT ALL ON public.cycle_reports TO service_role;

ALTER TABLE public.cycle_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can read cycle reports"
  ON public.cycle_reports FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = cycle_reports.household_id
      AND hm.user_id = auth.uid()
  ));
