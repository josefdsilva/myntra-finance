-- Per-cycle snapshot of a space's key metrics, written once a cycle closes.
--
-- This is the foundation of the "compounding value over time" track: it lets
-- bynku show how a household or company evolves across cycles (score trend,
-- superfluous share, estimate-vs-actual accuracy, cycle-vs-cycle comparison)
-- without recomputing history from raw rows. Point-in-time values that CANNOT be
-- faithfully reconstructed later — the health score as it was, and the estimates
-- in force at close — are captured here on purpose.
--
-- One row per (space, closed cycle). Keyed by cycle_start (the canonical,
-- immutable cycle key, same convention as cycle_reports). Writes are idempotent
-- upserts; `source` records how a row was produced ('close' at rollover, 'cron'
-- from the daily hook, 'backfill' reconstructed from existing data — the last is
-- money-accurate but its score/estimates are approximate and flagged in the UI).
CREATE TABLE public.cycle_metrics (
  id                UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id      UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  -- Denormalised so history can be filtered/plotted without joining households.
  kind             TEXT NOT NULL DEFAULT 'personal'
                   CHECK (kind IN ('personal','business')),
  cycle_start      DATE NOT NULL,
  cycle_end        DATE NOT NULL,

  -- Money actuals for the cycle (all in the space's currency).
  income_actual    NUMERIC(14,2) NOT NULL DEFAULT 0,
  spend_actual     NUMERIC(14,2) NOT NULL DEFAULT 0,
  fixed_total      NUMERIC(14,2) NOT NULL DEFAULT 0,
  debt_total       NUMERIC(14,2) NOT NULL DEFAULT 0,
  project_funded   NUMERIC(14,2) NOT NULL DEFAULT 0,
  surplus_actual   NUMERIC(14,2) NOT NULL DEFAULT 0,
  everyday_pool    NUMERIC(14,2) NOT NULL DEFAULT 0,
  everyday_spent   NUMERIC(14,2) NOT NULL DEFAULT 0,
  available_end    NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- Quality ratios (leak-free; safe for any shareable surface).
  score_overall     NUMERIC,           -- 0-100, null when not scoreable that cycle
  superfluous_share NUMERIC,           -- 0..1, null when too little tagged spend
  consumption_ratio NUMERIC,           -- outgoings / income

  -- Estimates in force at close, for calibration (planned vs actual).
  income_expected   NUMERIC,
  planned_spend     NUMERIC,
  baseline_at_close NUMERIC,

  -- Richer, extensible payload: sub-score breakdown, business KPIs
  -- (margin, runway, cash movement), per-plan intention-vs-actual, etc.
  metrics          JSONB NOT NULL DEFAULT '{}'::jsonb,

  source           TEXT NOT NULL DEFAULT 'close'
                   CHECK (source IN ('close','cron','backfill')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (household_id, cycle_start)
);

CREATE INDEX cycle_metrics_hh_idx ON public.cycle_metrics(household_id, cycle_start);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cycle_metrics TO authenticated;
GRANT ALL ON public.cycle_metrics TO service_role;

ALTER TABLE public.cycle_metrics ENABLE ROW LEVEL SECURITY;

-- Members can read and write their own space's history; the daily cron writes via
-- the service role (bypasses RLS). Same helper other household tables use.
CREATE POLICY "members manage cycle metrics"
  ON public.cycle_metrics FOR ALL TO authenticated
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

CREATE TRIGGER cycle_metrics_touch_updated_at
  BEFORE UPDATE ON public.cycle_metrics
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
