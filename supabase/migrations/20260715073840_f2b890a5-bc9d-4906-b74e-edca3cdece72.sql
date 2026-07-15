
-- Lock down SECURITY DEFINER trigger/helper functions that must NOT be callable via the API.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_default_categories() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Fund/debt RPCs are intentionally called by signed-in users; restrict to authenticated only (no anon, no PUBLIC).
REVOKE ALL ON FUNCTION public.fund_deposit(uuid, uuid, numeric, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fund_deposit(uuid, uuid, numeric, text, date, text) TO authenticated;

REVOKE ALL ON FUNCTION public.fund_withdrawal(uuid, uuid, numeric, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fund_withdrawal(uuid, uuid, numeric, text, date, text) TO authenticated;

REVOKE ALL ON FUNCTION public.fund_transfer(uuid, uuid, uuid, numeric, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fund_transfer(uuid, uuid, uuid, numeric, text, date, text) TO authenticated;

REVOKE ALL ON FUNCTION public.service_debt(uuid, uuid, numeric, text, uuid, numeric, numeric, date, text, text, text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.service_debt(uuid, uuid, numeric, text, uuid, numeric, numeric, date, text, text, text, date, date) TO authenticated;
