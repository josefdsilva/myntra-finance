-- Manual cash-on-hand override for SME runway.
--
-- Runway = cash on hand / monthly burn. We estimate cash on hand from what bynku
-- knows (liquid assets), but the owner is the source of truth for the real bank
-- balance, so they can set an override that supersedes the estimate. Stored on
-- the space; NULL means "use the computed estimate".
ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS cash_on_hand_override    NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS cash_on_hand_override_at TIMESTAMPTZ;
