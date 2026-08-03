-- Coach inbox: the persistent home for proactive nudges.
--
-- Every proactive message the coach produces (cycle recaps, drift alerts, cost
-- reminders, milestones, SME runway/receivable warnings) is written here first.
-- Web push and email are opt-in amplifiers layered on top; this table is the
-- source of truth and the in-app inbox reads from it.
--
-- user_id NULL means the message is for the whole household (every member sees
-- it); a set user_id targets one person. dedupe_key keeps emits idempotent so a
-- re-run of a cron never double-posts.
CREATE TABLE public.coach_messages (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id  UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  severity      TEXT NOT NULL DEFAULT 'info'
                CHECK (severity IN ('info','success','warn','critical')),
  title         TEXT NOT NULL,
  body          TEXT NOT NULL DEFAULT '',
  action_label  TEXT,
  action_url    TEXT,
  data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  cycle_start   DATE,
  dedupe_key    TEXT NOT NULL,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, dedupe_key)
);

CREATE INDEX coach_messages_hh_idx ON public.coach_messages(household_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_messages TO authenticated;
GRANT ALL ON public.coach_messages TO service_role;

ALTER TABLE public.coach_messages ENABLE ROW LEVEL SECURITY;

-- Members see household-wide messages and their own; can mark read / dismiss.
-- The cron writes via the service role (bypasses RLS).
CREATE POLICY "members manage coach messages"
  ON public.coach_messages FOR ALL TO authenticated
  USING (
    private.is_household_member(household_id, auth.uid())
    AND (user_id IS NULL OR user_id = auth.uid())
  )
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

-- Per-channel master toggles. The in-app inbox is always on; these gate the
-- optional amplifiers. Push defaults on (still needs a subscribed device),
-- email defaults off (explicit opt-in).
ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS push_enabled  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN NOT NULL DEFAULT false;
