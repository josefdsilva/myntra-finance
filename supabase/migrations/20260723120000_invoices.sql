-- Invoices / receipts attached to expenses (and to plans when a planned expense
-- is paid). Important for businesses, who must keep proof alongside every cost.
--
-- Files live in a PRIVATE Storage bucket; only signed URLs ever expose them.
-- Storage objects are namespaced by household id as the first path segment
-- ({household_id}/{uuid}/{filename}) so the same is_household_member check that
-- guards every table also guards the files. No cross-household access, ever.

-- 1) Private bucket (idempotent). Images + PDF, capped at 10 MB per file.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2) Storage RLS: a member of household H can read/write objects under H/...
DROP POLICY IF EXISTS "invoices objects read" ON storage.objects;
CREATE POLICY "invoices objects read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'invoices'
    AND private.is_household_member((split_part(name, '/', 1))::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "invoices objects insert" ON storage.objects;
CREATE POLICY "invoices objects insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'invoices'
    AND private.is_household_member((split_part(name, '/', 1))::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "invoices objects update" ON storage.objects;
CREATE POLICY "invoices objects update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'invoices'
    AND private.is_household_member((split_part(name, '/', 1))::uuid, auth.uid())
  )
  WITH CHECK (
    bucket_id = 'invoices'
    AND private.is_household_member((split_part(name, '/', 1))::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "invoices objects delete" ON storage.objects;
CREATE POLICY "invoices objects delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'invoices'
    AND private.is_household_member((split_part(name, '/', 1))::uuid, auth.uid())
  );

-- 3) Metadata table: one row per attached file, linked to an expense or a plan.
CREATE TABLE public.invoices (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  expense_id   UUID REFERENCES public.expenses(id) ON DELETE CASCADE,
  plan_id      UUID REFERENCES public.plans(id) ON DELETE CASCADE,
  path         TEXT NOT NULL,
  file_name    TEXT,
  mime_type    TEXT,
  size_bytes   BIGINT,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invoices_target_chk CHECK (expense_id IS NOT NULL OR plan_id IS NOT NULL)
);

CREATE INDEX invoices_expense_idx ON public.invoices(expense_id);
CREATE INDEX invoices_plan_idx ON public.invoices(plan_id);
CREATE INDEX invoices_hh_idx ON public.invoices(household_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));
