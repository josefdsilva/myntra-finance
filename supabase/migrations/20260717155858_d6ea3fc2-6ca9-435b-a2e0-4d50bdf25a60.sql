
CREATE TABLE public.coach_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX coach_conversations_hh_updated_idx ON public.coach_conversations(household_id, updated_at DESC);

CREATE TABLE public.coach_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.coach_conversations(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX coach_messages_conv_created_idx ON public.coach_messages(conversation_id, created_at ASC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_messages TO authenticated;
GRANT ALL ON public.coach_conversations TO service_role;
GRANT ALL ON public.coach_messages TO service_role;

ALTER TABLE public.coach_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_conversations_household_access"
  ON public.coach_conversations FOR ALL
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

CREATE POLICY "coach_messages_household_access"
  ON public.coach_messages FOR ALL
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

-- Keep only the 5 most recent conversations per household. Runs after insert.
CREATE OR REPLACE FUNCTION public.trim_coach_conversations()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.coach_conversations
  WHERE household_id = NEW.household_id
    AND id NOT IN (
      SELECT id FROM public.coach_conversations
      WHERE household_id = NEW.household_id
      ORDER BY updated_at DESC
      LIMIT 5
    );
  RETURN NULL;
END;
$$;

CREATE TRIGGER coach_conversations_trim
AFTER INSERT ON public.coach_conversations
FOR EACH ROW EXECUTE FUNCTION public.trim_coach_conversations();
