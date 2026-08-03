-- Allow a "cash" asset kind.
--
-- A savings or current account balance with no specific goal is not a project
-- (projects/buckets are savings WITH an objective) — it is simply a liquid
-- asset. Until now the only fit was "other", which understated how liquid that
-- money is. Add "cash" to the allowed kinds so it can be recorded properly and
-- counted as liquid in net worth.
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_kind_check;
ALTER TABLE public.assets
  ADD CONSTRAINT assets_kind_check
  CHECK (kind IN ('cash','property','land','vehicle','stocks','bonds','fund','business','other'));
