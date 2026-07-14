-- Correct service_debt: the post-payment principal is computed by the client
-- amortization engine (which accounts for scheduled paydown since the last
-- anchor) and passed in as p_new_principal. The server no longer derives the
-- remaining balance by naive subtraction. Falls back to subtraction only if
-- p_new_principal is omitted.

DROP FUNCTION IF EXISTS public.service_debt(
  UUID, UUID, NUMERIC, TEXT, UUID, TEXT, NUMERIC, DATE, TEXT, TEXT, DATE, DATE
);

CREATE OR REPLACE FUNCTION public.service_debt(
  p_household UUID,
  p_debt UUID,
  p_amount NUMERIC,
  p_source_type TEXT,               -- 'cash' | 'bucket'
  p_source_bucket UUID DEFAULT NULL,
  p_new_principal NUMERIC DEFAULT NULL,   -- engine-computed remaining after overpayment
  p_new_installment NUMERIC DEFAULT NULL,
  p_new_maturity DATE DEFAULT NULL,
  p_recompute_mode TEXT DEFAULT NULL,     -- 'reduce_installment' | 'shorten_term'
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

  -- Engine-computed remaining wins; otherwise fall back to naive subtraction.
  v_after := GREATEST(0, COALESCE(p_new_principal, v_before - p_amount));

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

REVOKE EXECUTE ON FUNCTION public.service_debt(
  UUID, UUID, NUMERIC, TEXT, UUID, NUMERIC, NUMERIC, DATE, TEXT, TEXT, TEXT, DATE, DATE
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.service_debt(
  UUID, UUID, NUMERIC, TEXT, UUID, NUMERIC, NUMERIC, DATE, TEXT, TEXT, TEXT, DATE, DATE
) TO authenticated, service_role;
