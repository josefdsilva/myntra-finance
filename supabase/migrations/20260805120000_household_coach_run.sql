-- Per-space stamp of the last local date the daily coach pass ran.
--
-- The coach runs "at 8am in the user's timezone" without any external cron:
-- when someone opens the app after 08:00 local, the client asks the server to
-- run the pass, and this column makes it idempotent — it only runs once per
-- local day per space, no matter how many members or devices open the app.
ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS coach_run_on DATE;
