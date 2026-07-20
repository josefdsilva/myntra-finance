-- Assets: significant things the household owns and their value (houses, land,
-- vehicles, stocks, bonds, funds, a business). NOT consumables. Assets are the
-- honest other half of the financial picture: net worth = assets - loans.
--
-- Forward-looking (no UI yet): an asset can be pledged as collateral for a loan
-- (debt_id) or generate regular income like rent (income_id). Those links are
-- nullable columns now so they can be wired up later without another migration.
CREATE TABLE public.assets (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id   UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  kind           TEXT NOT NULL DEFAULT 'other'
                 CHECK (kind IN ('property','land','vehicle','stocks','bonds','fund','business','other')),
  -- What it was worth when acquired, and when. Both optional (may be unknown).
  acquired_value NUMERIC(14,2) CHECK (acquired_value IS NULL OR acquired_value >= 0),
  acquired_on    DATE,
  -- Current estimated value, user-maintained.
  current_value  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (current_value >= 0),
  -- How quickly it can be turned into cash.
  liquidity      TEXT NOT NULL DEFAULT 'semi_liquid'
                 CHECK (liquidity IN ('liquid','semi_liquid','illiquid')),
  note           TEXT,
  -- Future links (built later): collateral for a loan / a rental income source.
  debt_id        UUID REFERENCES public.debts(id) ON DELETE SET NULL,
  income_id      UUID REFERENCES public.incomes(id) ON DELETE SET NULL,
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX assets_hh_idx ON public.assets(household_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage assets"
  ON public.assets FOR ALL TO authenticated
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

CREATE TRIGGER assets_touch_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
