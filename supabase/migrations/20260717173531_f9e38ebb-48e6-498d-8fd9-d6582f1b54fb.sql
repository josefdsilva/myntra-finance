
-- Move privileged bodies to `private` and expose SECURITY INVOKER wrappers in public.
CREATE SCHEMA IF NOT EXISTS private;

-- 1) redeem_beta_code
CREATE OR REPLACE FUNCTION private.redeem_beta_code(p_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_code public.beta_codes;
  v_att public.beta_redeem_attempts;
  v_used integer;
  v_max_attempts constant integer := 3;
  v_window constant interval := interval '1 hour';
BEGIN
  IF v_user IS NULL THEN RETURN 'unauthorized'; END IF;
  IF EXISTS (SELECT 1 FROM public.beta_members WHERE user_id = v_user) THEN RETURN 'ok'; END IF;
  INSERT INTO public.beta_redeem_attempts (user_id) VALUES (v_user) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_att FROM public.beta_redeem_attempts WHERE user_id = v_user FOR UPDATE;
  IF now() - v_att.window_start > v_window THEN
    UPDATE public.beta_redeem_attempts SET attempts = 0, window_start = now() WHERE user_id = v_user;
    v_att.attempts := 0;
  END IF;
  IF v_att.attempts >= v_max_attempts THEN RETURN 'rate_limited'; END IF;
  SELECT * INTO v_code FROM public.beta_codes WHERE code = p_code AND active = true FOR UPDATE;
  IF NOT FOUND THEN
    UPDATE public.beta_redeem_attempts SET attempts = attempts + 1 WHERE user_id = v_user;
    RETURN 'invalid';
  END IF;
  SELECT count(*) INTO v_used FROM public.beta_members WHERE code_id = v_code.id;
  IF v_used >= v_code.max_seats THEN RETURN 'full'; END IF;
  INSERT INTO public.beta_members (user_id, code_id) VALUES (v_user, v_code.id);
  RETURN 'ok';
END;
$function$;

REVOKE ALL ON FUNCTION private.redeem_beta_code(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.redeem_beta_code(p_code text)
RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path = private, public, pg_temp
AS $function$
  SELECT private.redeem_beta_code(p_code);
$function$;

-- 2) log_scheduled_debt_payment
CREATE OR REPLACE FUNCTION private.log_scheduled_debt_payment(
  p_household uuid, p_debt uuid, p_period date, p_amount numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
DECLARE v_id UUID;
BEGIN
  IF NOT private.is_household_member(p_household, auth.uid()) THEN
    RAISE EXCEPTION 'not a household member';
  END IF;
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

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION private.log_scheduled_debt_payment(uuid, uuid, date, numeric) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_scheduled_debt_payment(
  p_household uuid, p_debt uuid, p_period date, p_amount numeric
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = private, public, pg_temp
AS $function$
  SELECT private.log_scheduled_debt_payment(p_household, p_debt, p_period, p_amount);
$function$;
