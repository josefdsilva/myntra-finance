-- assets
DROP POLICY IF EXISTS "members manage assets" ON public.assets;
CREATE POLICY "members read assets" ON public.assets FOR SELECT TO authenticated
USING (private.is_household_member(household_id, auth.uid()));
CREATE POLICY "members insert assets" ON public.assets FOR INSERT TO authenticated
WITH CHECK (private.is_household_member(household_id, auth.uid())
  AND (created_by IS NULL OR created_by = auth.uid()));
CREATE POLICY "members update assets" ON public.assets FOR UPDATE TO authenticated
USING (private.is_household_member(household_id, auth.uid()))
WITH CHECK (private.is_household_member(household_id, auth.uid())
  AND (created_by IS NULL OR created_by = auth.uid()));
CREATE POLICY "members delete assets" ON public.assets FOR DELETE TO authenticated
USING (private.is_household_member(household_id, auth.uid()));

-- invoices
DROP POLICY IF EXISTS "members manage invoices" ON public.invoices;
CREATE POLICY "members read invoices" ON public.invoices FOR SELECT TO authenticated
USING (private.is_household_member(household_id, auth.uid()));
CREATE POLICY "members insert invoices" ON public.invoices FOR INSERT TO authenticated
WITH CHECK (private.is_household_member(household_id, auth.uid())
  AND (created_by IS NULL OR created_by = auth.uid()));
CREATE POLICY "members update invoices" ON public.invoices FOR UPDATE TO authenticated
USING (private.is_household_member(household_id, auth.uid()))
WITH CHECK (private.is_household_member(household_id, auth.uid())
  AND (created_by IS NULL OR created_by = auth.uid()));
CREATE POLICY "members delete invoices" ON public.invoices FOR DELETE TO authenticated
USING (private.is_household_member(household_id, auth.uid()));

-- plans
DROP POLICY IF EXISTS "members manage plans" ON public.plans;
CREATE POLICY "members read plans" ON public.plans FOR SELECT TO authenticated
USING (private.is_household_member(household_id, auth.uid()));
CREATE POLICY "members insert plans" ON public.plans FOR INSERT TO authenticated
WITH CHECK (private.is_household_member(household_id, auth.uid())
  AND (created_by IS NULL OR created_by = auth.uid()));
CREATE POLICY "members update plans" ON public.plans FOR UPDATE TO authenticated
USING (private.is_household_member(household_id, auth.uid()))
WITH CHECK (private.is_household_member(household_id, auth.uid())
  AND (created_by IS NULL OR created_by = auth.uid()));
CREATE POLICY "members delete plans" ON public.plans FOR DELETE TO authenticated
USING (private.is_household_member(household_id, auth.uid()));

-- fixed_expense_settlements
DROP POLICY IF EXISTS "members manage fixed expense settlements" ON public.fixed_expense_settlements;
CREATE POLICY "members read fixed expense settlements" ON public.fixed_expense_settlements FOR SELECT TO authenticated
USING (private.is_household_member(household_id, auth.uid()));
CREATE POLICY "members insert fixed expense settlements" ON public.fixed_expense_settlements FOR INSERT TO authenticated
WITH CHECK (private.is_household_member(household_id, auth.uid())
  AND (created_by IS NULL OR created_by = auth.uid()));
CREATE POLICY "members update fixed expense settlements" ON public.fixed_expense_settlements FOR UPDATE TO authenticated
USING (private.is_household_member(household_id, auth.uid()))
WITH CHECK (private.is_household_member(household_id, auth.uid())
  AND (created_by IS NULL OR created_by = auth.uid()));
CREATE POLICY "members delete fixed expense settlements" ON public.fixed_expense_settlements FOR DELETE TO authenticated
USING (private.is_household_member(household_id, auth.uid()));

-- bucket_allocations
DROP POLICY IF EXISTS "members manage allocations" ON public.bucket_allocations;
CREATE POLICY "members read allocations" ON public.bucket_allocations FOR SELECT TO authenticated
USING (private.is_household_member(household_id, auth.uid()));
CREATE POLICY "members insert allocations" ON public.bucket_allocations FOR INSERT TO authenticated
WITH CHECK (private.is_household_member(household_id, auth.uid())
  AND confirmed_by = auth.uid());
CREATE POLICY "members update allocations" ON public.bucket_allocations FOR UPDATE TO authenticated
USING (private.is_household_member(household_id, auth.uid()))
WITH CHECK (private.is_household_member(household_id, auth.uid())
  AND confirmed_by = auth.uid());
CREATE POLICY "members delete allocations" ON public.bucket_allocations FOR DELETE TO authenticated
USING (private.is_household_member(household_id, auth.uid()));

-- coach_messages
DROP POLICY IF EXISTS "members manage coach messages" ON public.coach_messages;
CREATE POLICY "members read coach messages" ON public.coach_messages FOR SELECT TO authenticated
USING (private.is_household_member(household_id, auth.uid())
  AND (user_id IS NULL OR user_id = auth.uid()));
CREATE POLICY "members insert coach messages" ON public.coach_messages FOR INSERT TO authenticated
WITH CHECK (private.is_household_member(household_id, auth.uid())
  AND (user_id IS NULL OR user_id = auth.uid()));
CREATE POLICY "members update coach messages" ON public.coach_messages FOR UPDATE TO authenticated
USING (private.is_household_member(household_id, auth.uid())
  AND (user_id IS NULL OR user_id = auth.uid()))
WITH CHECK (private.is_household_member(household_id, auth.uid())
  AND (user_id IS NULL OR user_id = auth.uid()));
CREATE POLICY "members delete coach messages" ON public.coach_messages FOR DELETE TO authenticated
USING (private.is_household_member(household_id, auth.uid())
  AND (user_id IS NULL OR user_id = auth.uid()));