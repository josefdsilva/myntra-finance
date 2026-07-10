
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view household categories" ON public.expense_categories
  FOR SELECT USING (private.is_household_member(household_id, auth.uid()));
CREATE POLICY "Members insert household categories" ON public.expense_categories
  FOR INSERT WITH CHECK (private.is_household_member(household_id, auth.uid()));
CREATE POLICY "Members update household categories" ON public.expense_categories
  FOR UPDATE USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));
CREATE POLICY "Members delete household categories" ON public.expense_categories
  FOR DELETE USING (private.is_household_member(household_id, auth.uid()));

CREATE TRIGGER touch_expense_categories BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed defaults for existing households
INSERT INTO public.expense_categories (household_id, name, sort_order)
SELECT h.id, c.name, c.ord
FROM public.households h
CROSS JOIN (VALUES
  ('groceries',10),('dining',20),('transport',30),('fuel',40),('utilities',50),
  ('housing',60),('subscriptions',70),('health',80),('kids',90),('shopping',100),
  ('entertainment',110),('travel',120),('gifts',130),('income',140),('other',150)
) AS c(name, ord)
ON CONFLICT DO NOTHING;

-- Auto-seed defaults for new households
CREATE OR REPLACE FUNCTION public.seed_default_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.expense_categories (household_id, name, sort_order) VALUES
    (NEW.id,'groceries',10),(NEW.id,'dining',20),(NEW.id,'transport',30),
    (NEW.id,'fuel',40),(NEW.id,'utilities',50),(NEW.id,'housing',60),
    (NEW.id,'subscriptions',70),(NEW.id,'health',80),(NEW.id,'kids',90),
    (NEW.id,'shopping',100),(NEW.id,'entertainment',110),(NEW.id,'travel',120),
    (NEW.id,'gifts',130),(NEW.id,'income',140),(NEW.id,'other',150)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_categories_on_household_insert
  AFTER INSERT ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_categories();
