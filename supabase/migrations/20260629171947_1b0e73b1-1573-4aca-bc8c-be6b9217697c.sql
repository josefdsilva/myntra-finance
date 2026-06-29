
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_household_member(_household_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = _household_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION private.current_user_household()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT household_id FROM public.household_members
  WHERE user_id = auth.uid()
  ORDER BY joined_at ASC
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION private.is_household_member(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.current_user_household() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_household_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_user_household() TO authenticated, service_role;

-- Recreate policies to reference private.is_household_member
DROP POLICY IF EXISTS "Members can view their household" ON public.households;
CREATE POLICY "Members can view their household" ON public.households
  FOR SELECT USING (private.is_household_member(id, auth.uid()));

DROP POLICY IF EXISTS "Members can view their household members" ON public.household_members;
CREATE POLICY "Members can view their household members" ON public.household_members
  FOR SELECT USING (private.is_household_member(household_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view invites for their household" ON public.household_invitations;
CREATE POLICY "Members can view invites for their household" ON public.household_invitations
  FOR SELECT USING (private.is_household_member(household_id, auth.uid()));

DROP POLICY IF EXISTS "Members can create invites" ON public.household_invitations;
CREATE POLICY "Members can create invites" ON public.household_invitations
  FOR INSERT WITH CHECK (private.is_household_member(household_id, auth.uid()) AND invited_by = auth.uid());

DROP POLICY IF EXISTS "Members can delete invites" ON public.household_invitations;
CREATE POLICY "Members can delete invites" ON public.household_invitations
  FOR DELETE USING (private.is_household_member(household_id, auth.uid()));

DROP POLICY IF EXISTS "Members manage incomes" ON public.incomes;
CREATE POLICY "Members manage incomes" ON public.incomes
  FOR ALL USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

DROP POLICY IF EXISTS "Members manage fixed expenses" ON public.fixed_expenses;
CREATE POLICY "Members manage fixed expenses" ON public.fixed_expenses
  FOR ALL USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

DROP POLICY IF EXISTS "Members manage buckets" ON public.buckets;
CREATE POLICY "Members manage buckets" ON public.buckets
  FOR ALL USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

DROP POLICY IF EXISTS "Members manage expenses" ON public.expenses;
CREATE POLICY "Members manage expenses" ON public.expenses
  FOR ALL USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

DROP POLICY IF EXISTS "Members manage bank imports" ON public.bank_imports;
CREATE POLICY "Members manage bank imports" ON public.bank_imports
  FOR ALL USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

-- Now drop the public-schema versions
DROP FUNCTION IF EXISTS public.is_household_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.current_user_household();
