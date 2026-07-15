-- Keep households.baseline_budget correct no matter which path writes the inputs
-- (Settings, onboarding, statement import, direct edits). Previously the baseline
-- was only recomputed in the Settings screen, so it went stale/zero after
-- onboarding or a statement import.
--
--   baseline = (fixed_monthly + debt_monthly + variable_monthly) * (1 + margin%)

CREATE OR REPLACE FUNCTION public.recompute_household_baseline(_household_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_base   numeric;
  v_margin numeric;
BEGIN
  SELECT COALESCE(margin_pct, 0) INTO v_margin FROM public.households WHERE id = _household_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_base :=
      COALESCE((SELECT SUM(monthly_amount) FROM public.fixed_expenses WHERE household_id = _household_id), 0)
    + COALESCE((SELECT SUM(monthly_amount) FROM public.debts WHERE household_id = _household_id), 0)
    + COALESCE((SELECT SUM(monthly_amount) FROM public.variable_estimates WHERE household_id = _household_id), 0);

  UPDATE public.households
  SET baseline_budget = round(v_base * (1 + v_margin / 100.0), 2)
  WHERE id = _household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_household_baseline(uuid) FROM PUBLIC, anon, authenticated;

-- Row trigger for the three input tables (insert / update / delete).
CREATE OR REPLACE FUNCTION public.trg_recompute_baseline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.recompute_household_baseline(COALESCE(NEW.household_id, OLD.household_id));
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_recompute_baseline() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS fixed_expenses_baseline ON public.fixed_expenses;
CREATE TRIGGER fixed_expenses_baseline
  AFTER INSERT OR UPDATE OR DELETE ON public.fixed_expenses
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_baseline();

DROP TRIGGER IF EXISTS debts_baseline ON public.debts;
CREATE TRIGGER debts_baseline
  AFTER INSERT OR UPDATE OR DELETE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_baseline();

DROP TRIGGER IF EXISTS variable_estimates_baseline ON public.variable_estimates;
CREATE TRIGGER variable_estimates_baseline
  AFTER INSERT OR UPDATE OR DELETE ON public.variable_estimates
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_baseline();

-- Recompute when the margin slider changes. Guarded so the recompute's own
-- baseline_budget update (which does not touch margin_pct) can't recurse.
CREATE OR REPLACE FUNCTION public.trg_recompute_baseline_hh()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.recompute_household_baseline(NEW.id);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_recompute_baseline_hh() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS households_margin_baseline ON public.households;
CREATE TRIGGER households_margin_baseline
  AFTER UPDATE OF margin_pct ON public.households
  FOR EACH ROW
  WHEN (OLD.margin_pct IS DISTINCT FROM NEW.margin_pct)
  EXECUTE FUNCTION public.trg_recompute_baseline_hh();

-- Backfill every existing household so stale/zero baselines are corrected now.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.households LOOP
    PERFORM public.recompute_household_baseline(r.id);
  END LOOP;
END $$;
