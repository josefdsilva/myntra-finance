// "Time to dream" — the one lever that makes a journey rung or a project feel
// real: how long it takes at the household's current saving pace, and how much
// sooner it lands if they free a little more each month.
//
// Pure and deterministic so it can be unit-tested and reused by the journey,
// the projects list and the coach without any of them re-deriving the maths.

export type PaceResult = {
  /** Months to close the gap at the current pace (rounded up), null when unknowable. */
  months: number | null;
  /** ISO date (YYYY-MM-DD) when the gap closes at the current pace, null when unknowable. */
  etaIso: string | null;
  /** The extra monthly amount the swap lever suggests freeing up (EUR). */
  swapEur: number;
  /** Months to close the gap with the swap applied, null when unknowable. */
  monthsWithSwap: number | null;
  /** How many months sooner the swap lands it (0 when it makes no difference). */
  monthsSaved: number;
};

/** A tidy, believable "find this much more per month" amount. */
export function swapLever(paceEur: number, gapEur: number): number {
  const fromPace = Math.max(0, paceEur) * 0.2;
  const fromGap = Math.max(0, gapEur) * 0.02;
  const raw = Math.max(10, Math.max(fromPace, fromGap));
  const step = raw >= 100 ? 25 : raw >= 50 ? 10 : 5;
  return Math.round(raw / step) * step;
}

function monthsFor(gapEur: number, paceEur: number): number | null {
  if (gapEur <= 0) return 0;
  if (paceEur <= 0) return null;
  return Math.ceil(gapEur / paceEur);
}

function addMonths(from: Date, months: number): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * @param gapEur  What is still missing (EUR) — target minus balance, or debt left.
 * @param paceEur What the household frees up per month right now (EUR).
 */
export function timeToDream(gapEur: number, paceEur: number, now: Date = new Date()): PaceResult {
  const gap = Math.max(0, gapEur);
  const pace = Math.max(0, paceEur);
  const months = monthsFor(gap, pace);
  const swapEur = swapLever(pace, gap);
  const monthsWithSwap = monthsFor(gap, pace + swapEur);
  const monthsSaved =
    months != null && monthsWithSwap != null ? Math.max(0, months - monthsWithSwap) : 0;
  return {
    months,
    etaIso: months == null ? null : addMonths(now, months),
    swapEur,
    monthsWithSwap,
    monthsSaved,
  };
}
