import { joinWaitlistFn } from "@/lib/waitlist.functions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  const e = email.trim();
  return e.length >= 3 && e.length <= 320 && EMAIL_RE.test(e);
}

/**
 * Register an email on the waiting list. Validation, dedupe and consent are
 * handled server-side by the joinWaitlistFn server function; nothing is
 * exposed to anonymous database callers.
 */
export async function joinWaitlist(email: string, locale?: string): Promise<void> {
  await joinWaitlistFn({ data: { email: email.trim(), locale: locale ?? null } });
}

