-- Security hardening: the "Owners can update household" UPDATE policy had a
-- USING clause but no WITH CHECK, so a row wasn't re-validated against the same
-- ownership condition AFTER the update. Add a matching WITH CHECK that mirrors
-- USING. No behaviour change for a legitimate owner editing their own household;
-- it just closes the gap where an update could move a row into a state the user
-- couldn't have created.
DROP POLICY IF EXISTS "Owners can update household" ON public.households;
CREATE POLICY "Owners can update household"
  ON public.households FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_id = households.id AND user_id = auth.uid() AND role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_id = households.id AND user_id = auth.uid() AND role = 'owner'
    )
  );
