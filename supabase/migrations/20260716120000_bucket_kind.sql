-- Classify projects (buckets) so the coach, tips and allocation suggestions can
-- reason about the emergency-fund-first / then-invest priority. A project is one
-- of: savings (a goal), emergency (the safety cushion), investment (growth money
-- we should not raid lightly).

CREATE TYPE public.bucket_kind AS ENUM ('savings', 'emergency', 'investment');

ALTER TABLE public.buckets
  ADD COLUMN IF NOT EXISTS kind public.bucket_kind NOT NULL DEFAULT 'savings';

-- Conservative, best-effort backfill from the project name across the app's five
-- locales. Anything unmatched stays 'savings'; the user can correct it in Settings.
UPDATE public.buckets
SET kind = 'investment'
WHERE kind = 'savings'
  AND name ~* '(invest|\metf\M|\mppr\M|pens|reforma|retire|retrait|ruhestand|aktien|bourse|\mstock|ações|acoes|obrigaç|\mbond\M|crypto|bitcoin)';

UPDATE public.buckets
SET kind = 'emergency'
WHERE kind = 'savings'
  AND name ~* '(emerg|notfall|urgenc|rainy\s*day|colchão|colchao|fundo de reserva|reserva de)';
