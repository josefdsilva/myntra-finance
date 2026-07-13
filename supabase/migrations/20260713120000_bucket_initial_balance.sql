-- Allow a bucket to start with pre-existing funds (e.g. an emergency fund that
-- already has savings in it before this app starts tracking contributions).
ALTER TABLE public.buckets
  ADD COLUMN IF NOT EXISTS initial_balance NUMERIC(12,2) NOT NULL DEFAULT 0;
