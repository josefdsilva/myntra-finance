-- Soft-dismiss for coach messages.
--
-- Dismissing used to DELETE the row, but the row's (household_id, dedupe_key)
-- is exactly what makes emits idempotent — so a deleted message would be
-- re-created on the coach's next run. Keep the row and hide it with a
-- dismissed_at timestamp instead, so a dismissal (and a read) is durable.
ALTER TABLE public.coach_messages
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;
