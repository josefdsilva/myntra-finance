import { supabase } from "@/integrations/supabase/client";

// Client helper for the pre-launch waiting list. The insert goes through the
// SECURITY DEFINER RPC join_waitlist (see the waitlist migration), which
// validates, dedupes and records consent server-side. We cast the client for
// this one call so we do not depend on the generated Database types being
// regenerated for the new function.
type WaitlistRpc = {
  rpc: (
    fn: "join_waitlist",
    args: { p_email: string; p_locale: string | null; p_source: string },
  ) => Promise<{ error: { message: string } | null }>;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  const e = email.trim();
  return e.length >= 3 && e.length <= 320 && EMAIL_RE.test(e);
}

/**
 * Register an email on the waiting list. Resolves on success (including when the
 * address was already present, which the RPC swallows silently). Rejects only on
 * a genuine transport or validation error.
 */
export async function joinWaitlist(email: string, locale?: string): Promise<void> {
  const client = supabase as unknown as WaitlistRpc;
  const { error } = await client.rpc("join_waitlist", {
    p_email: email.trim(),
    p_locale: locale ?? null,
    p_source: "landing",
  });
  if (error) throw new Error(error.message);
}
