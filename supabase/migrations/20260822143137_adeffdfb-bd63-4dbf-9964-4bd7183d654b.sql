ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS life_values jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.household_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text,
  age integer,
  role text NOT NULL DEFAULT 'adult',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_people TO authenticated;
GRANT ALL ON public.household_people TO service_role;

ALTER TABLE public.household_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hp_select" ON public.household_people
  FOR SELECT TO authenticated
  USING (private.is_household_member(household_id, auth.uid()));

CREATE POLICY "hp_insert" ON public.household_people
  FOR INSERT TO authenticated
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

CREATE POLICY "hp_update" ON public.household_people
  FOR UPDATE TO authenticated
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

CREATE POLICY "hp_delete" ON public.household_people
  FOR DELETE TO authenticated
  USING (private.is_household_member(household_id, auth.uid()));

CREATE INDEX IF NOT EXISTS household_people_household_idx
  ON public.household_people(household_id, sort_order);

CREATE TRIGGER household_people_touch_updated_at
  BEFORE UPDATE ON public.household_people
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();