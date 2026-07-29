-- NACE Rev. 2 division code (2-digit, e.g. '62' = computer programming) for a
-- business space. Optional: used only to benchmark the company against its
-- sector on the "How you compare" card (Eurostat SBS). Households ignore it.
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS sector text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'households_sector_check'
  ) THEN
    -- Keep it a short code; the app maps it to a NACE division. Blank/NULL means
    -- "no sector chosen yet" (comparison is hidden until set).
    ALTER TABLE public.households
      ADD CONSTRAINT households_sector_check
      CHECK (sector IS NULL OR char_length(sector) <= 8);
  END IF;
END $$;
