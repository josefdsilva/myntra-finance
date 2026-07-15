
-- Ensure private schema exists
CREATE SCHEMA IF NOT EXISTS private;

-- Move the SECURITY DEFINER RPCs out of the exposed public schema
ALTER FUNCTION public.fund_deposit(uuid, uuid, numeric, text, date, text) SET SCHEMA private;
ALTER FUNCTION public.fund_withdrawal(uuid, uuid, numeric, text, date, text) SET SCHEMA private;
ALTER FUNCTION public.fund_transfer(uuid, uuid, uuid, numeric, text, date, text) SET SCHEMA private;
ALTER FUNCTION public.service_debt(uuid, uuid, numeric, text, uuid, numeric, numeric, date, text, text, text, date, date) SET SCHEMA private;

-- Allow authenticated callers to execute the private definer functions when reached from public wrappers
REVOKE ALL ON FUNCTION private.fund_deposit(uuid, uuid, numeric, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.fund_deposit(uuid, uuid, numeric, text, date, text) TO authenticated;

REVOKE ALL ON FUNCTION private.fund_withdrawal(uuid, uuid, numeric, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.fund_withdrawal(uuid, uuid, numeric, text, date, text) TO authenticated;

REVOKE ALL ON FUNCTION private.fund_transfer(uuid, uuid, uuid, numeric, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.fund_transfer(uuid, uuid, uuid, numeric, text, date, text) TO authenticated;

REVOKE ALL ON FUNCTION private.service_debt(uuid, uuid, numeric, text, uuid, numeric, numeric, date, text, text, text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.service_debt(uuid, uuid, numeric, text, uuid, numeric, numeric, date, text, text, text, date, date) TO authenticated;

-- SECURITY INVOKER wrappers in public keep the RPC surface unchanged for the client
CREATE OR REPLACE FUNCTION public.fund_deposit(
  p_household uuid, p_bucket uuid, p_amount numeric,
  p_reason text DEFAULT NULL, p_period date DEFAULT CURRENT_DATE, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = private, public, pg_temp
AS $$
  SELECT private.fund_deposit(p_household, p_bucket, p_amount, p_reason, p_period, p_note);
$$;

CREATE OR REPLACE FUNCTION public.fund_withdrawal(
  p_household uuid, p_bucket uuid, p_amount numeric,
  p_reason text DEFAULT NULL, p_period date DEFAULT CURRENT_DATE, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = private, public, pg_temp
AS $$
  SELECT private.fund_withdrawal(p_household, p_bucket, p_amount, p_reason, p_period, p_note);
$$;

CREATE OR REPLACE FUNCTION public.fund_transfer(
  p_household uuid, p_from_bucket uuid, p_to_bucket uuid, p_amount numeric,
  p_reason text DEFAULT NULL, p_period date DEFAULT CURRENT_DATE, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = private, public, pg_temp
AS $$
  SELECT private.fund_transfer(p_household, p_from_bucket, p_to_bucket, p_amount, p_reason, p_period, p_note);
$$;

CREATE OR REPLACE FUNCTION public.service_debt(
  p_household uuid, p_debt uuid, p_amount numeric, p_source_type text,
  p_source_bucket uuid DEFAULT NULL,
  p_new_principal numeric DEFAULT NULL,
  p_new_installment numeric DEFAULT NULL,
  p_new_maturity date DEFAULT NULL,
  p_recompute_mode text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_period date DEFAULT CURRENT_DATE,
  p_as_of date DEFAULT CURRENT_DATE
) RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = private, public, pg_temp
AS $$
  SELECT private.service_debt(
    p_household, p_debt, p_amount, p_source_type, p_source_bucket,
    p_new_principal, p_new_installment, p_new_maturity, p_recompute_mode,
    p_reason, p_note, p_period, p_as_of
  );
$$;

REVOKE ALL ON FUNCTION public.fund_deposit(uuid, uuid, numeric, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fund_deposit(uuid, uuid, numeric, text, date, text) TO authenticated;

REVOKE ALL ON FUNCTION public.fund_withdrawal(uuid, uuid, numeric, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fund_withdrawal(uuid, uuid, numeric, text, date, text) TO authenticated;

REVOKE ALL ON FUNCTION public.fund_transfer(uuid, uuid, uuid, numeric, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fund_transfer(uuid, uuid, uuid, numeric, text, date, text) TO authenticated;

REVOKE ALL ON FUNCTION public.service_debt(uuid, uuid, numeric, text, uuid, numeric, numeric, date, text, text, text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.service_debt(uuid, uuid, numeric, text, uuid, numeric, numeric, date, text, text, text, date, date) TO authenticated;
