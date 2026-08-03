-- Public waiting list for the pre-launch landing page.
--
-- Visitors who are not signed in can register interest (an email address) so we
-- can notify them when bynku opens up. GDPR posture:
--   * Lawful basis is consent. The UI only calls join_waitlist() after the
--     person ticks an explicit, non pre-checked consent box, and we stamp
--     consent_at at insert time.
--   * Data minimisation: we store the email, the UI locale, a source tag and the
--     consent timestamp. Nothing else. No IP or user agent is persisted.
--   * The table is not readable by anon or authenticated roles at all (no SELECT
--     policy, no grants). Only the service role (server side, for export or to
--     send the launch email) can read it, which also prevents email enumeration.
--   * Writes go exclusively through a SECURITY DEFINER RPC that upserts with
--     ON CONFLICT DO NOTHING, so a repeat sign-up cannot leak whether an address
--     is already on the list.

CREATE TABLE public.waitlist (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email       TEXT NOT NULL,
  -- Normalised form used to dedupe; unique so a person is only listed once.
  email_norm  TEXT GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  locale      TEXT,
  source      TEXT NOT NULL DEFAULT 'landing',
  consent     BOOLEAN NOT NULL DEFAULT true,
  consent_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email_norm)
);

-- Lock the table down. No direct table privileges for public-facing roles; the
-- service role keeps full access (it bypasses RLS anyway, but be explicit).
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waitlist FROM anon, authenticated;
GRANT ALL ON public.waitlist TO service_role;

-- The only way in: a definer function that validates and dedupes. Consent is
-- implied by calling it (the UI gates the call on the ticked box) and recorded.
CREATE OR REPLACE FUNCTION public.join_waitlist(
  p_email  TEXT,
  p_locale TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'landing'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_email IS NULL
     OR char_length(btrim(p_email)) < 3
     OR char_length(p_email) > 320
     OR position('@' IN p_email) < 2 THEN
    RAISE EXCEPTION 'invalid email' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.waitlist (email, locale, source, consent, consent_at)
  VALUES (btrim(p_email), p_locale, coalesce(p_source, 'landing'), true, now())
  ON CONFLICT (email_norm) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.join_waitlist(TEXT, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.join_waitlist(TEXT, TEXT, TEXT) TO anon, authenticated;
