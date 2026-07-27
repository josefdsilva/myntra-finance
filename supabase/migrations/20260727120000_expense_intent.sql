-- Purchase "intent" / need-level for an expense, on a supportive, non-judgy
-- 4-point scale: essential, important, nice_to_have, treat. A treat is a healthy
-- part of a working budget, not a failure — the scale just lets the coach adjust
-- its tolerance (celebrate treats when the household is on track; gently point at
-- the treat share when the reserve is thin).
--
-- Nullable by design: an unset expense falls back to a sensible default derived
-- from its category in app code, so no backfill is needed and existing rows keep
-- working. Additive, expand-only — safe to run on a live database.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS intent text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_intent_check'
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_intent_check
      CHECK (intent IS NULL OR intent IN ('essential', 'important', 'nice_to_have', 'treat'));
  END IF;
END $$;
