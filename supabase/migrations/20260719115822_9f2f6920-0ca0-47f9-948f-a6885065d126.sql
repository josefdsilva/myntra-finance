CREATE OR REPLACE FUNCTION public.redeem_beta_code(p_code text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'private', 'public', 'pg_temp'
AS $function$
  SELECT private.redeem_beta_code(p_code);
$function$;

REVOKE ALL ON FUNCTION public.redeem_beta_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_beta_code(text) TO authenticated;