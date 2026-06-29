
-- Lock down security definer helpers
REVOKE EXECUTE ON FUNCTION public.is_household_member(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_household() FROM PUBLIC, anon;
-- current_user_household needs to be callable by authenticated for client-side household lookup
GRANT EXECUTE ON FUNCTION public.current_user_household() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_member(UUID, UUID) TO authenticated;

-- Fix search_path on trigger function
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
