-- Beta access codes with per-code seat limits and per-user attempt throttling.
-- Replaces the single BETA_ACCESS_CODE env var: codes now live in a table so you
-- can cap how many people each code admits and issue several codes over time.

CREATE TABLE IF NOT EXISTS public.beta_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text UNIQUE NOT NULL,
  label      text,
  max_seats  integer NOT NULL CHECK (max_seats >= 0),
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.beta_codes ENABLE ROW LEVEL SECURITY;
-- No client policies at all: only the SECURITY DEFINER redeem function reads it,
-- and you manage codes from the SQL editor / dashboard.

-- Record which code each member used, so remaining seats = max_seats - count.
ALTER TABLE public.beta_members
  ADD COLUMN IF NOT EXISTS code_id uuid REFERENCES public.beta_codes(id) ON DELETE SET NULL;

-- Per-user redemption attempts, for throttling (max 3 per rolling hour).
CREATE TABLE IF NOT EXISTS public.beta_redeem_attempts (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  attempts     integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.beta_redeem_attempts ENABLE ROW LEVEL SECURITY;

-- Atomic redeem: throttle, validate the code, enforce the seat cap, then admit.
-- Returns one of: 'ok', 'invalid', 'full', 'rate_limited', 'unauthorized'.
CREATE OR REPLACE FUNCTION public.redeem_beta_code(p_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user         uuid := auth.uid();
  v_code         public.beta_codes;
  v_att          public.beta_redeem_attempts;
  v_used         integer;
  v_max_attempts constant integer := 3;
  v_window       constant interval := interval '1 hour';
BEGIN
  IF v_user IS NULL THEN
    RETURN 'unauthorized';
  END IF;

  -- Already activated? Idempotent success, no attempt counted.
  IF EXISTS (SELECT 1 FROM public.beta_members WHERE user_id = v_user) THEN
    RETURN 'ok';
  END IF;

  -- Load (and lock) this user's throttle row, resetting an expired window.
  INSERT INTO public.beta_redeem_attempts (user_id) VALUES (v_user)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_att FROM public.beta_redeem_attempts WHERE user_id = v_user FOR UPDATE;
  IF now() - v_att.window_start > v_window THEN
    UPDATE public.beta_redeem_attempts
      SET attempts = 0, window_start = now()
      WHERE user_id = v_user;
    v_att.attempts := 0;
  END IF;
  IF v_att.attempts >= v_max_attempts THEN
    RETURN 'rate_limited';
  END IF;

  -- Look up the code, locking the row so two people can't take the last seat.
  SELECT * INTO v_code FROM public.beta_codes
    WHERE code = p_code AND active = true
    FOR UPDATE;
  IF NOT FOUND THEN
    UPDATE public.beta_redeem_attempts SET attempts = attempts + 1 WHERE user_id = v_user;
    RETURN 'invalid';
  END IF;

  -- Seat check.
  SELECT count(*) INTO v_used FROM public.beta_members WHERE code_id = v_code.id;
  IF v_used >= v_code.max_seats THEN
    RETURN 'full';
  END IF;

  INSERT INTO public.beta_members (user_id, code_id) VALUES (v_user, v_code.id);
  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_beta_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_beta_code(text) TO authenticated;
