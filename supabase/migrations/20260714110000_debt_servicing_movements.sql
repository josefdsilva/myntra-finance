-- Debt servicing & fund movements (phase 2)
-- Adds amortization anchors to debts, an append-only account_movements ledger,
-- a bucket-balance helper, and atomic RPCs for deposit / withdraw / transfer /
-- service-debt. Movements live ALONGSIDE bucket_allocations; a bucket's balance
-- folds in both.

-- 1. debts: amortization schedule anchors -----------------------------------

ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS starting_principal NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS tan_pct            NUMERIC(6,3),   -- optional nominal rate (precise schedule)
  ADD COLUMN IF NOT EXISTS opened_at          DATE,
  ADD COLUMN IF NOT EXISTS last_recompute_at  DATE;

-- Backfill existing rows: treat today's remaining principal as the schedule
-- anchor. starting_principal defaults to the current remaining balance.
UPDATE public.debts
SET starting_principal = COALESCE(starting_principal, principal_remaining),
    opened_at          = COALESCE(opened_at, created_at::date),
    last_recompute_at  = COALESCE(last_recompute_at, created_at::date)
WHERE starting_principal IS NULL
   OR opened_at IS NULL
   OR last_recompute_at IS NULL;

-- 2. enums -------------------------------------------------------------------

CREATE TYPE public.movement_account_type AS ENUM ('cash', 'bucket', 'debt');
CREATE TYPE public.movement_kind AS ENUM ('deposit', 'withdrawal', 'transfer', 'debt_payment');

-- 3. account_movements ledger (append-only) ----------------------------------

CREATE TABLE public.account_movements (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id     UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  period           DATE NOT NULL,
  kind             public.movement_kind NOT NULL,
  from_type        public.movement_account_type,
  from_id          UUID,
  to_type          public.movement_account_type,
  to_id            UUID,
  amount           NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  reason           TEXT,
  note             TEXT,
  -- debt overpayment bookkeeping (null for non-debt movements)
  principal_before NUMERIC(14,2),
  principal_after  NUMERIC(14,2),
  recompute_mode   TEXT CHECK (recompute_mode IN ('reduce_installment', 'shorten_term')),
  created_by       UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX account_movements_hh_period_idx ON public.account_movements(household_id, period DESC);
CREATE INDEX account_movements_to_idx        ON public.account_movements(household_id, to_type, to_id);
CREATE INDEX account_movements_from_idx      ON public.account_movements(household_id, from_type, from_id);

GRANT SELECT, INSERT, DELETE ON public.account_movements TO authenticated;
GRANT ALL ON public.account_movements TO service_role;

ALTER TABLE public.account_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read movements"
  ON public.account_movements FOR SELECT TO authenticated
  USING (private.is_household_member(household_id, auth.uid()));

-- Writes go through the SECURITY DEFINER RPCs below, but allow a member to
-- delete/correct their own household's rows directly if needed.
CREATE POLICY "members delete movements"
  ON public.account_movements FOR DELETE TO authenticated
  USING (private.is_household_member(household_id, auth.uid()));

-- 4. bucket balance helper ---------------------------------------------------
-- Balance = initial + confirmed allocations + movements in - movements out.

CREATE OR REPLACE FUNCTION private.bucket_balance(_bucket_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT COALESCE((SELECT initial_balance FROM public.buckets WHERE id = _bucket_id), 0)
    + COALESCE((SELECT SUM(amount) FROM public.bucket_allocations WHERE bucket_id = _bucket_id), 0)
    + COALESCE((SELECT SUM(amount) FROM public.account_movements
                WHERE to_type = 'bucket' AND to_id = _bucket_id), 0)
    - COALESCE((SELECT SUM(amount) FROM public.account_movements
                WHERE from_type = 'bucket' AND from_id = _bucket_id), 0);
$$;

REVOKE EXECUTE ON FUNCTION private.bucket_balance(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.bucket_balance(UUID) TO authenticated, service_role;

-- 5. RPCs --------------------------------------------------------------------

-- Add funds: cash -> bucket
CREATE OR REPLACE FUNCTION public.fund_deposit(
  p_household UUID, p_bucket UUID, p_amount NUMERIC, p_reason TEXT DEFAULT NULL,
  p_period DATE DEFAULT CURRENT_DATE, p_note TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT private.is_household_member(p_household, auth.uid()) THEN
    RAISE EXCEPTION 'not a household member';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.buckets WHERE id = p_bucket AND household_id = p_household) THEN
    RAISE EXCEPTION 'bucket not in household';
  END IF;

  INSERT INTO public.account_movements
    (household_id, period, kind, from_type, to_type, to_id, amount, reason, note, created_by)
  VALUES
    (p_household, p_period, 'deposit', 'cash', 'bucket', p_bucket, p_amount, p_reason, p_note, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Withdraw funds: bucket -> cash (validates balance)
CREATE OR REPLACE FUNCTION public.fund_withdrawal(
  p_household UUID, p_bucket UUID, p_amount NUMERIC, p_reason TEXT DEFAULT NULL,
  p_period DATE DEFAULT CURRENT_DATE, p_note TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT private.is_household_member(p_household, auth.uid()) THEN
    RAISE EXCEPTION 'not a household member';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.buckets WHERE id = p_bucket AND household_id = p_household) THEN
    RAISE EXCEPTION 'bucket not in household';
  END IF;
  IF private.bucket_balance(p_bucket) < p_amount THEN
    RAISE EXCEPTION 'insufficient bucket balance';
  END IF;

  INSERT INTO public.account_movements
    (household_id, period, kind, from_type, from_id, to_type, amount, reason, note, created_by)
  VALUES
    (p_household, p_period, 'withdrawal', 'bucket', p_bucket, 'cash', p_amount, p_reason, p_note, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Transfer: bucket -> bucket (validates source balance)
CREATE OR REPLACE FUNCTION public.fund_transfer(
  p_household UUID, p_from_bucket UUID, p_to_bucket UUID, p_amount NUMERIC,
  p_reason TEXT DEFAULT NULL, p_period DATE DEFAULT CURRENT_DATE, p_note TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT private.is_household_member(p_household, auth.uid()) THEN
    RAISE EXCEPTION 'not a household member';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  IF p_from_bucket = p_to_bucket THEN RAISE EXCEPTION 'cannot transfer to the same bucket'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.buckets WHERE id = p_from_bucket AND household_id = p_household)
     OR NOT EXISTS (SELECT 1 FROM public.buckets WHERE id = p_to_bucket AND household_id = p_household) THEN
    RAISE EXCEPTION 'bucket not in household';
  END IF;
  IF private.bucket_balance(p_from_bucket) < p_amount THEN
    RAISE EXCEPTION 'insufficient bucket balance';
  END IF;

  INSERT INTO public.account_movements
    (household_id, period, kind, from_type, from_id, to_type, to_id, amount, reason, note, created_by)
  VALUES
    (p_household, p_period, 'transfer', 'bucket', p_from_bucket, 'bucket', p_to_bucket, p_amount,
     p_reason, p_note, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Service debt: cash|bucket -> debt. The new installment / maturity are computed
-- by the client amortization engine and passed in; the server owns principal,
-- atomicity, and balance validation. Overpayment reduces principal in full.
CREATE OR REPLACE FUNCTION public.service_debt(
  p_household UUID,
  p_debt UUID,
  p_amount NUMERIC,
  p_source_type TEXT,               -- 'cash' | 'bucket'
  p_source_bucket UUID DEFAULT NULL,
  p_recompute_mode TEXT DEFAULT NULL,   -- 'reduce_installment' | 'shorten_term'
  p_new_installment NUMERIC DEFAULT NULL,
  p_new_maturity DATE DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_period DATE DEFAULT CURRENT_DATE,
  p_as_of DATE DEFAULT CURRENT_DATE
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_before NUMERIC(14,2);
  v_after  NUMERIC(14,2);
  v_from_type public.movement_account_type;
  v_id UUID;
BEGIN
  IF NOT private.is_household_member(p_household, auth.uid()) THEN
    RAISE EXCEPTION 'not a household member';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  IF p_source_type NOT IN ('cash', 'bucket') THEN RAISE EXCEPTION 'invalid source type'; END IF;

  -- Lock the debt row for the duration of the update.
  SELECT COALESCE(principal_remaining, 0) INTO v_before
  FROM public.debts WHERE id = p_debt AND household_id = p_household
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'debt not in household'; END IF;

  IF p_source_type = 'bucket' THEN
    IF p_source_bucket IS NULL THEN RAISE EXCEPTION 'source bucket required'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.buckets WHERE id = p_source_bucket AND household_id = p_household) THEN
      RAISE EXCEPTION 'bucket not in household';
    END IF;
    IF private.bucket_balance(p_source_bucket) < p_amount THEN
      RAISE EXCEPTION 'insufficient bucket balance';
    END IF;
    v_from_type := 'bucket';
  ELSE
    v_from_type := 'cash';
  END IF;

  v_after := GREATEST(0, v_before - p_amount);

  INSERT INTO public.account_movements
    (household_id, period, kind, from_type, from_id, to_type, to_id, amount, reason, note,
     principal_before, principal_after, recompute_mode, created_by)
  VALUES
    (p_household, p_period, 'debt_payment', v_from_type,
     CASE WHEN v_from_type = 'bucket' THEN p_source_bucket ELSE NULL END,
     'debt', p_debt, p_amount, p_reason, p_note,
     v_before, v_after, p_recompute_mode, auth.uid())
  RETURNING id INTO v_id;

  UPDATE public.debts
  SET principal_remaining = v_after,
      monthly_amount      = CASE WHEN v_after = 0 THEN 0
                                 ELSE COALESCE(p_new_installment, monthly_amount) END,
      maturity_date       = COALESCE(p_new_maturity, maturity_date),
      last_recompute_at   = COALESCE(p_as_of, CURRENT_DATE),
      updated_at          = now()
  WHERE id = p_debt;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION
  public.fund_deposit(UUID, UUID, NUMERIC, TEXT, DATE, TEXT),
  public.fund_withdrawal(UUID, UUID, NUMERIC, TEXT, DATE, TEXT),
  public.fund_transfer(UUID, UUID, UUID, NUMERIC, TEXT, DATE, TEXT),
  public.service_debt(UUID, UUID, NUMERIC, TEXT, UUID, TEXT, NUMERIC, DATE, TEXT, TEXT, DATE, DATE)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.fund_deposit(UUID, UUID, NUMERIC, TEXT, DATE, TEXT),
  public.fund_withdrawal(UUID, UUID, NUMERIC, TEXT, DATE, TEXT),
  public.fund_transfer(UUID, UUID, UUID, NUMERIC, TEXT, DATE, TEXT),
  public.service_debt(UUID, UUID, NUMERIC, TEXT, UUID, TEXT, NUMERIC, DATE, TEXT, TEXT, DATE, DATE)
  TO authenticated, service_role;
