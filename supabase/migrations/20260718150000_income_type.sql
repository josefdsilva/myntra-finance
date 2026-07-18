-- Give each income a plain type, so the app knows what kind of money it is
-- (salary, rent, pension, benefits, other). Feeds the coach, sharpens the
-- single-income-source warning, and "rent" hints at owned property for a later
-- worth view. Defaults to salary so existing rows are unaffected.
ALTER TABLE public.incomes
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'salary'
  CHECK (type IN ('salary', 'rent', 'pension', 'benefits', 'other'));
