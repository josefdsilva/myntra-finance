-- Asset depreciation (mainly for business spaces). A company's equipment,
-- vehicles and fit-out lose value over time; net worth should reflect the
-- written-down (book) value, not the purchase price. We store the straight-line
-- inputs and let the app compute the book value as of any date, so an asset that
-- was already partially depreciated when it was entered is handled naturally
-- (its depreciation_start sits in the past).
--
-- method 'none' keeps the old behaviour: current_value is whatever the user set.
-- method 'straight_line' derives current_value from cost, salvage, useful life
-- and the depreciation start date.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS depreciation_method TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS useful_life_months  INTEGER,
  ADD COLUMN IF NOT EXISTS salvage_value       NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depreciation_start  DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assets_depreciation_method_check'
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_depreciation_method_check
      CHECK (depreciation_method IN ('none', 'straight_line'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assets_useful_life_months_check'
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_useful_life_months_check
      CHECK (useful_life_months IS NULL OR useful_life_months > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assets_salvage_value_check'
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_salvage_value_check
      CHECK (salvage_value >= 0);
  END IF;
END $$;
