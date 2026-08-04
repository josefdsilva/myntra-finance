ALTER TABLE public.coach_messages
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.coach_conversations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS content text;

ALTER TABLE public.coach_messages
  ALTER COLUMN kind SET DEFAULT 'chat',
  ALTER COLUMN title SET DEFAULT '',
  ALTER COLUMN dedupe_key SET DEFAULT gen_random_uuid()::text;

CREATE INDEX IF NOT EXISTS coach_messages_conversation_created_idx
  ON public.coach_messages (conversation_id, created_at);