
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS credit_cap numeric(10,4) NOT NULL DEFAULT 10;

CREATE TABLE IF NOT EXISTS public.credit_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid,
  operation text NOT NULL,
  credits numeric(12,6) NOT NULL DEFAULT 0,
  input_tokens integer,
  output_tokens integer,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_usage_household_created_idx
  ON public.credit_usage(household_id, created_at DESC);

GRANT SELECT ON public.credit_usage TO authenticated;
GRANT ALL ON public.credit_usage TO service_role;

ALTER TABLE public.credit_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read household credit usage"
  ON public.credit_usage FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = credit_usage.household_id AND hm.user_id = auth.uid()
    )
  );
