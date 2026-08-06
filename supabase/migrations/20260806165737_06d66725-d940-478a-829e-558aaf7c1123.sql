DELETE FROM public.cycle_metrics cm
USING public.households h
WHERE cm.household_id = h.id
  AND cm.source = 'backfill'
  AND cm.cycle_end <= LEAST(
    h.created_at::date,
    COALESCE((SELECT MIN(e.occurred_at)::date FROM public.expenses e WHERE e.household_id = h.id), h.created_at::date)
  );