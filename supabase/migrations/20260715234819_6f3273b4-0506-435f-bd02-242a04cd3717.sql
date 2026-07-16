
-- Explicitly deny client-side INSERT/UPDATE/DELETE on notification_log.
-- Writes only happen via service_role (edge/server functions), which bypasses RLS.
CREATE POLICY "No client writes to notification_log"
  ON public.notification_log
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "No client updates to notification_log"
  ON public.notification_log
  FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No client deletes to notification_log"
  ON public.notification_log
  FOR DELETE
  TO authenticated, anon
  USING (false);

-- Explicitly deny client-side INSERT/UPDATE on household_members. Membership
-- rows (and role assignment) are only mutated by server functions using the
-- service role after validating invitations. Owner-driven removal already has
-- a DELETE policy.
CREATE POLICY "No client inserts to household_members"
  ON public.household_members
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "No client updates to household_members"
  ON public.household_members
  FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);
