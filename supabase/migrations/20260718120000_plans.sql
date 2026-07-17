-- Planned money events: future-dated one-offs and changes the user knows about
-- ahead of time (tyres in August, car service in October, +800 income from
-- September, more spending in December). Plans do NOT change the standing monthly
-- baseline (which stays recurring-only). They power a forward forecast and can
-- each be turned into a goal_by_date project (sinking fund) to save ahead.
CREATE TABLE public.plans (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  -- Always stored positive; `direction` says whether it is money out or in.
  amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  direction    TEXT NOT NULL DEFAULT 'spend' CHECK (direction IN ('spend', 'income')),
  -- The month the plan lands in, stored as the first day of that month.
  month        DATE NOT NULL,
  -- one_off: happens once in `month`. annual: repeats every year in that month.
  -- ongoing: recurs every month from `month` onward (e.g. a new income stream).
  recurrence   TEXT NOT NULL DEFAULT 'one_off' CHECK (recurrence IN ('one_off', 'annual', 'ongoing')),
  category     TEXT,
  -- Optional funding project (sinking fund) created for this plan.
  bucket_id    UUID REFERENCES public.buckets(id) ON DELETE SET NULL,
  note         TEXT,
  done         BOOLEAN NOT NULL DEFAULT false,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX plans_hh_month_idx ON public.plans(household_id, month);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage plans"
  ON public.plans FOR ALL TO authenticated
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

CREATE TRIGGER plans_touch_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
