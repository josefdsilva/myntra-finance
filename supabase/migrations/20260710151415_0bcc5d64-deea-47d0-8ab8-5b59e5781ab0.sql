ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS labels text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS expenses_labels_gin_idx ON public.expenses USING GIN (labels);