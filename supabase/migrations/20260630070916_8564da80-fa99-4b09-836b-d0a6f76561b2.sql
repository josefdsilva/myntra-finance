DO $$ BEGIN
  CREATE TYPE public.entry_kind AS ENUM ('expense', 'income');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS kind public.entry_kind NOT NULL DEFAULT 'expense';

CREATE INDEX IF NOT EXISTS expenses_household_kind_occurred_idx
  ON public.expenses (household_id, kind, occurred_at DESC);