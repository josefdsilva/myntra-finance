-- Cache for AI statement extraction, keyed on a hash of the uploaded file.
-- Re-uploading the same file (common after a failed import) then reuses the
-- prior extraction instead of paying for the model again, and makes a retry
-- deterministic. Household-scoped; the result is the same signed-transaction
-- list the extractor returns.
CREATE TABLE public.ai_extraction_cache (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  file_hash    TEXT NOT NULL,
  result       JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, file_hash)
);

CREATE INDEX ai_extraction_cache_hh_idx ON public.ai_extraction_cache(household_id);

GRANT SELECT, INSERT, DELETE ON public.ai_extraction_cache TO authenticated;
GRANT ALL ON public.ai_extraction_cache TO service_role;

ALTER TABLE public.ai_extraction_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage extraction cache"
  ON public.ai_extraction_cache FOR ALL TO authenticated
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));
