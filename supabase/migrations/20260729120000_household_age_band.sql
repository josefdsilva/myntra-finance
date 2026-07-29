-- Optional age band of the household's main earner. Used only to make the
-- net-worth and debt comparisons on the "How you compare" card fair (wealth is
-- strongly age-dependent). Nullable: blank means "compare against all ages".
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS age_band text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'households_age_band_check'
  ) THEN
    ALTER TABLE public.households
      ADD CONSTRAINT households_age_band_check
      CHECK (
        age_band IS NULL
        OR age_band IN ('under35', '35_44', '45_54', '55_64', '65_74', '75plus')
      );
  END IF;
END $$;
