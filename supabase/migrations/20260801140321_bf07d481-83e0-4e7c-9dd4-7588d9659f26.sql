REVOKE EXECUTE ON FUNCTION public.reset_household(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_household(uuid) TO authenticated;