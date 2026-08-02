-- Per-user "app tour seen" marker. Null = never seen, so the welcome tour
-- auto-shows on first login: a brand-new owner (before the setup wizard) and an
-- invited member landing on the dashboard both see it once. Lives on the
-- per-user profile so it follows the person across devices. The existing
-- self-update RLS policy on profiles already lets a user set their own value.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tour_seen_at timestamptz;
