-- KPI Targets: measured (not funded) goals. A target picks a metric, an operator
-- and a value (optionally by a date). Progress is COMPUTED live from data bynku
-- already holds — nothing is allocated into it. Reach-only: reached once, done.
-- Sibling of `buckets` (funded projects); a journey stage links to either.

CREATE TABLE IF NOT EXISTS public.kpi_targets (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id  UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  metric_key    TEXT NOT NULL
                CHECK (metric_key IN (
                  'emergency_months', 'dti_pct', 'invested_months', 'invested_years',
                  'total_income', 'income_concentration', 'spending_vs_plan'
                )),
  op            TEXT NOT NULL DEFAULT '>='
                CHECK (op IN ('>=', '<=')),
  target_value  NUMERIC NOT NULL,
  target_date   DATE,
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'reached')),
  reached_at    TIMESTAMPTZ,
  created_by    TEXT NOT NULL DEFAULT 'user',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kpi_targets_hh_idx
  ON public.kpi_targets(household_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_targets TO authenticated;
GRANT ALL ON public.kpi_targets TO service_role;

ALTER TABLE public.kpi_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage kpi targets"
  ON public.kpi_targets FOR ALL TO authenticated
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

CREATE TRIGGER kpi_targets_touch_updated_at
  BEFORE UPDATE ON public.kpi_targets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
