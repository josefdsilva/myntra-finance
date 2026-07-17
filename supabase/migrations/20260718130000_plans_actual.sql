-- Planned vs reality: when a plan is resolved, record what it actually cost so
-- history reflects reality rather than the estimate (e.g. a 705 insurance quote
-- negotiated down to 620). `done` marks it resolved; `actual_amount` holds the
-- real figure (0 when the plan did not happen). Resolved plans drop out of the
-- forward forecast and move to the "done" history.
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS actual_amount NUMERIC(14,2) CHECK (actual_amount >= 0);
