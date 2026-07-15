-- First-run onboarding. Households with a null onboarded_at get the setup wizard.
-- Existing households are marked as already onboarded so only newly-created ones
-- trigger it.
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;
UPDATE public.households SET onboarded_at = now() WHERE onboarded_at IS NULL;
