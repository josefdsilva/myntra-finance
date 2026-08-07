-- Money Journey: user- and coach-authored roadmap stages.
--
-- A stage is a milestone on the household's financial journey. Its objective is
-- evaluated live against numbers the app already computes (emergency months,
-- debt-to-income, invested amount, a project's balance) — this table stores WHAT
-- the stages are and their order, never a forked copy of the maths.
--
-- template_key ('starter'|'debt'|'net3'|'net6'|'invest') marks the seeded default
-- spine so its title/objective can render from i18n; title/objective override it
-- (and are the only text for user-created custom stages). objective_type decides
-- how it's judged: 'metric' (config = {key, op, value}), 'project' (config =
-- {bucket_id}) or 'custom' (marked done by hand). See docs/money-journey-plan.md.
CREATE TABLE IF NOT EXISTS public.journey_stages (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id     UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  template_key     TEXT,
  title            TEXT,
  objective        TEXT,
  objective_type   TEXT NOT NULL DEFAULT 'custom'
                   CHECK (objective_type IN ('metric', 'project', 'custom')),
  objective_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  optional         BOOLEAN NOT NULL DEFAULT false,
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'done')),
  reached_at       TIMESTAMPTZ,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_by       TEXT NOT NULL DEFAULT 'user',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS journey_stages_hh_idx
  ON public.journey_stages(household_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_stages TO authenticated;
GRANT ALL ON public.journey_stages TO service_role;

ALTER TABLE public.journey_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage journey stages"
  ON public.journey_stages FOR ALL TO authenticated
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));
