// Cadence of a recurring cashflow line (income or fixed cost). Recurring lines
// are perpetual: a cadence describes how often the amount repeats, with no end.
// monthly_amount elsewhere is always the monthly-equivalent computed from the
// native amount at this cadence, so all budget math stays cadence-agnostic.

export const CADENCES = ["weekly", "fortnightly", "monthly", "quarterly", "yearly"] as const;
export type Cadence = (typeof CADENCES)[number];

// Multiplier that turns a native amount at the given cadence into a
// monthly-equivalent. Weekly/fortnightly use the 52/26-week year so a weekly
// wage averages correctly across months of different lengths.
const MONTHLY_FACTOR: Record<Cadence, number> = {
  weekly: 52 / 12,
  fortnightly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

export function monthlyEquivalent(nativeAmount: number, cadence: Cadence): number {
  return Math.round(nativeAmount * MONTHLY_FACTOR[cadence] * 100) / 100;
}

export function isCadence(v: unknown): v is Cadence {
  return typeof v === "string" && (CADENCES as readonly string[]).includes(v);
}

// A space's budgeting/reporting cycle — the period aggregate figures are shown
// in. A subset of the cadences (no fortnightly): individuals run weekly/monthly,
// firms often quarterly/yearly.
export const CYCLES = ["weekly", "monthly", "quarterly", "yearly"] as const;
export type Cycle = (typeof CYCLES)[number];

/** Express a monthly-equivalent amount in the given cycle's period. */
export function perCycleFromMonthly(monthlyAmount: number, cycle: Cycle): number {
  return Math.round((monthlyAmount / MONTHLY_FACTOR[cycle]) * 100) / 100;
}

/** Sensible default cycle for a space kind. */
export function defaultCycleForKind(kind: string | null | undefined): Cycle {
  return kind === "business" ? "quarterly" : "monthly";
}

// Approximate months per one period, used only to decide whether a line's
// cadence is more frequent than the reporting cycle (so it should be reconciled
// per payment rather than once per cycle).
const CADENCE_MONTHS: Record<Cadence, number> = {
  weekly: 12 / 52,
  fortnightly: 12 / 26,
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};
const CYCLE_MONTHS: Record<Cycle, number> = { weekly: 12 / 52, monthly: 1, quarterly: 3, yearly: 12 };

/** Advance a date by one period of the given cadence. */
export function stepCadence(d: Date, cadence: Cadence): Date {
  const r = new Date(d);
  if (cadence === "weekly") r.setDate(r.getDate() + 7);
  else if (cadence === "fortnightly") r.setDate(r.getDate() + 14);
  else if (cadence === "monthly") r.setMonth(r.getMonth() + 1);
  else if (cadence === "quarterly") r.setMonth(r.getMonth() + 3);
  else r.setFullYear(r.getFullYear() + 1); // yearly
  return r;
}

export type Occurrence = { start: Date; end: Date; expected: number };

/**
 * The expected payment occurrences of a recurring line within a cycle, at the
 * line's own cadence. A monthly salary in a quarterly cycle yields three
 * occurrences (one per real pay run), each at the native per-payment amount —
 * so reconciliation and invoices happen per payment, not once per quarter.
 *
 * When the cadence is LESS frequent than the cycle (e.g. a yearly fee in a
 * quarterly cycle) we can't place the single payment in a specific cycle without
 * a due date, so we fall back to one accrued occurrence at the per-cycle amount.
 */
export function reconcileOccurrences(
  cadence: Cadence,
  nativeAmount: number,
  monthlyAmount: number,
  cycle: Cycle,
  cycleStart: Date,
  cycleEnd: Date,
): Occurrence[] {
  const per = nativeAmount || monthlyAmount;
  const expand = CADENCE_MONTHS[cadence] <= CYCLE_MONTHS[cycle] + 1e-6;
  if (!expand) {
    return [{ start: cycleStart, end: cycleEnd, expected: perCycleFromMonthly(monthlyAmount, cycle) }];
  }
  const out: Occurrence[] = [];
  let s = new Date(cycleStart);
  let guard = 0;
  while (s.getTime() < cycleEnd.getTime() && guard < 60) {
    const e = stepCadence(s, cadence);
    out.push({ start: new Date(s), end: e > cycleEnd ? new Date(cycleEnd) : new Date(e), expected: per });
    s = e;
    guard++;
  }
  return out.length ? out : [{ start: cycleStart, end: cycleEnd, expected: per }];
}

/** Resolve a household's stored cycle, falling back to the kind default. */
export function cycleForSpace(space: { cycle?: string | null; kind?: string | null } | null | undefined): Cycle {
  const c = space?.cycle;
  if (c && (CYCLES as readonly string[]).includes(c)) return c as Cycle;
  return defaultCycleForKind(space?.kind);
}
