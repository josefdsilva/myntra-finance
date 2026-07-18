
CREATE OR REPLACE FUNCTION private.redeem_beta_code(p_code text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_code public.beta_codes;
  v_att public.beta_redeem_attempts;
  v_used integer;
  v_max_attempts constant integer := 3;
  v_window constant interval := interval '1 hour';
  v_norm text := upper(btrim(coalesce(p_code, '')));
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
  SELECT * INTO v_code FROM public.beta_codes WHERE upper(btrim(code)) = v_norm AND active = true FOR UPDATE;
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
