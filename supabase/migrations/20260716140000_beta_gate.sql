-- Beta access gate. A user may only create a NEW household after redeeming the
-- shared beta code (verified server-side against the BETA_ACCESS_CODE env var).
-- People who are INVITED to an existing household bypass this — their invitation
-- is their ticket in. Existing members are unaffected.

CREATE TABLE IF NOT EXISTS public.beta_members (
  user_id      uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  activated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.beta_members ENABLE ROW LEVEL SECURITY;

-- A user may check their own activation status; nobody can write from the client
-- (activation happens only inside the redeemBetaCode server function, which uses
-- the service role).
CREATE POLICY "Users can read own beta membership"
  ON public.beta_members
  FOR SELECT
  USING (auth.uid() = user_id);
