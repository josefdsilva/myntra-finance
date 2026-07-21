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
