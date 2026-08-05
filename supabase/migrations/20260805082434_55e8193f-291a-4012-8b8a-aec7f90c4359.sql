DROP POLICY IF EXISTS "Members manage expenses" ON public.expenses;

CREATE POLICY "Members read expenses"
ON public.expenses FOR SELECT TO authenticated
USING (private.is_household_member(household_id, auth.uid()));

CREATE POLICY "Members insert own expenses"
ON public.expenses FOR INSERT TO authenticated
WITH CHECK (
  private.is_household_member(household_id, auth.uid())
  AND (added_by_user_id IS NULL OR added_by_user_id = auth.uid())
);

CREATE POLICY "Members update expenses"
ON public.expenses FOR UPDATE TO authenticated
USING (private.is_household_member(household_id, auth.uid()))
WITH CHECK (
  private.is_household_member(household_id, auth.uid())
  AND (added_by_user_id IS NULL OR added_by_user_id = auth.uid())
);

CREATE POLICY "Members delete expenses"
ON public.expenses FOR DELETE TO authenticated
USING (private.is_household_member(household_id, auth.uid()));