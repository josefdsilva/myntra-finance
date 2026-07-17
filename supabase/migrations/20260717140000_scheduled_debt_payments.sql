-- Scheduled monthly debt-payment log entries.
--
-- The debt progress bar is driven by the amortization projection (debt-schedule.ts):
-- it already advances every month as scheduled payments are assumed to be made.
-- This migration adds a visible LEDGER of that regular monthly payment: one row
-- per debt per cycle, dated the first day of the cycle. It deliberately does NOT
-- change principal_remaining (the projection stays authoritative), so a scheduled
-- log can never double-count the balance. Voluntary overpayments keep flowing
-- through service_debt() and remain distinguishable (reason <> 'scheduled').

-- Idempotency: at most one scheduled entry per (household, debt, period). The
-- partial predicate keeps voluntary debt payments in the same period unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS account_movements_scheduled_uniq
  ON public.account_movements (household_id, to_id, period)
  WHERE kind = 'debt_payment' AND reason = 'scheduled';

CREATE OR REPLACE FUNCTION public.log_scheduled_debt_payment(
  p_household UUID,
  p_debt      UUID,
  p_period    DATE,
  p_amount    NUMERIC
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
  -- Nothing to record for a zero / settled payment.
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.debts WHERE id = p_debt AND household_id = p_household) THEN
    RAISE EXCEPTION 'debt not in household';
  END IF;

  INSERT INTO public.account_movements
    (household_id, period, kind, from_type, to_type, to_id, amount, reason, created_by)
  VALUES
    (p_household, p_period, 'debt_payment', 'cash', 'debt', p_debt, p_amount, 'scheduled', auth.uid())
  ON CONFLICT (household_id, to_id, period)
    WHERE kind = 'debt_payment' AND reason = 'scheduled'
  DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id; -- NULL when a scheduled entry for this period already existed
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_scheduled_debt_payment(UUID, UUID, DATE, NUMERIC)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_scheduled_debt_payment(UUID, UUID, DATE, NUMERIC)
  TO authenticated, service_role;
