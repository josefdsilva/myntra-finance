-- Learned merchant → category mappings, so statement re-imports don't re-hit the
-- AI for merchants already seen. Populated by the AI fallback ('ai') or the user
-- correcting a category ('user'). Household-scoped.
CREATE TABLE public.merchant_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  merchant_key TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'ai',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, merchant_key)
);

CREATE INDEX merchant_rules_hh_idx ON public.merchant_rules(household_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_rules TO authenticated;
GRANT ALL ON public.merchant_rules TO service_role;

ALTER TABLE public.merchant_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage merchant rules"
  ON public.merchant_rules FOR ALL TO authenticated
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

CREATE TRIGGER merchant_rules_touch_updated_at
  BEFORE UPDATE ON public.merchant_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
