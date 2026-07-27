-- Least-privilege on invitation deletion.
--
-- Previously ANY household member could delete ANY pending invitation. That let
-- a non-privileged member revoke invites they didn't create and disrupt other
-- members' invitation flows. Restrict DELETE to the person who created the
-- invite (invited_by) or a household owner.
--
-- Note: creating invites remains open to any member by design (a partner can
-- invite someone), and reading is unchanged so the Members screen can still show
-- and copy pending invite links. Only the destructive action is tightened.
DROP POLICY IF EXISTS "Members can delete invites" ON public.household_invitations;

CREATE POLICY "Inviter or owner can delete invites"
  ON public.household_invitations
  FOR DELETE
  TO authenticated
  USING (
    invited_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.household_members hm
      WHERE hm.household_id = household_invitations.household_id
        AND hm.user_id = auth.uid()
        AND hm.role = 'owner'
    )
  );
