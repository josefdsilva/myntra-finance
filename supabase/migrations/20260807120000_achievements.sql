-- Achievements: an immutable log of milestones a household has earned.
--
-- Today medals (goal reached, health badges) are recomputed live, so editing a
-- goal or changing a number silently erases recognition. This table records an
-- achievement the moment it is first earned and never removes it — the atom the
-- Money Journey / roadmap is built on (see docs/money-journey-plan.md).
--
-- dedupe_key makes write-on-earn idempotent: one row per achievement per
-- household (e.g. "goal_reached:<bucket_id>"), so re-detecting a reached goal on
-- every render never double-posts.
CREATE TABLE IF NOT EXISTS public.achievements (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,           -- 'goal_reached' | 'badge' | 'stage_complete' | 'level_up'
  ref_type     TEXT,                    -- 'bucket' | 'stage' | NULL
  ref_id       UUID,
  title        TEXT NOT NULL,
  detail       TEXT,
  meta         JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key   TEXT NOT NULL,
  earned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS achievements_hh_idx
  ON public.achievements(household_id, earned_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- Members of the household can read and record achievements for it.
CREATE POLICY "members manage achievements"
  ON public.achievements FOR ALL TO authenticated
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));
