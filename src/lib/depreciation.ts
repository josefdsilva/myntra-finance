/**
 * Straight-line asset depreciation. Business assets (equipment, vehicles,
 * fit-out) lose value over a useful life; net worth should reflect the
 * written-down "book value", not the purchase price.
 *
 * The model stores the inputs (cost, salvage, useful life, start date) and
 * computes the book value as of any date. Because depreciation is anchored to a
 * `start` date, an asset that was already partially depreciated when it was
 * entered is handled with no special case — its start simply sits in the past.
 *
 * Everything here is pure so it can run identically in the UI (live preview) and
 * on the server (when persisting the current book value).
 */

export type DepreciationMethod = "none" | "straight_line";

export type DepreciationInput = {
  method: DepreciationMethod;
  /** Cost basis — what it was worth when acquired (or when depreciation began). */
  acquiredValue: number | null;
  /** Residual value at the end of the useful life (defaults to 0). */
  salvageValue: number;
  /** Total depreciation period, in months. */
  usefulLifeMonths: number | null;
  /** ISO date depreciation started (usually the acquisition date). */
  start: string | null;
};

export type DepreciationResult = {
  /** Depreciation charge per month. */
  monthly: number;
  /** Depreciation charge per year (monthly × 12). */
  annual: number;
  /** Total depreciation taken from start up to `asOf`. */
  accumulated: number;
  /** Written-down value: acquiredValue − accumulated (never below salvage). */
  bookValue: number;
  /** 0–100, share of the depreciable base already written off. */
  pctDepreciated: number;
  /** Whole-ish months elapsed since start (fractional, for smooth values). */
  monthsElapsed: number;
  /** Months of useful life still remaining (0 once fully depreciated). */
  remainingMonths: number;
  /** True once the whole useful life has elapsed. */
  fullyDepreciated: boolean;
};

// Average month length in ms — depreciation is a smooth estimate, not a
// day-count accounting entry, so a uniform month keeps the book value gliding
// down rather than stepping on the 1st.
const MONTH_MS = (365.25 / 12) * 24 * 60 * 60 * 1000;

function monthsBetween(start: string, asOf: Date): number {
  const s = new Date(`${start.slice(0, 10)}T00:00:00`).getTime();
  if (!isFinite(s)) return 0;
  return Math.max(0, (asOf.getTime() - s) / MONTH_MS);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Compute the depreciation position of an asset as of `asOf` (default: now).
 * Returns null when the asset isn't set up for straight-line depreciation or is
 * missing the inputs needed to compute it.
 */
export function computeDepreciation(
  input: DepreciationInput,
  asOf: Date = new Date(),
): DepreciationResult | null {
  if (input.method !== "straight_line") return null;
  const cost = input.acquiredValue;
  const life = input.usefulLifeMonths;
  if (cost == null || cost <= 0 || life == null || life <= 0 || !input.start) return null;

  const salvage = Math.max(0, Math.min(input.salvageValue || 0, cost));
  const base = cost - salvage; // depreciable amount
  const monthly = base / life;
  const monthsElapsed = monthsBetween(input.start, asOf);
  const accumulated = Math.min(base, monthly * monthsElapsed);
  const bookValue = cost - accumulated;
  const remainingMonths = Math.max(0, life - monthsElapsed);

  return {
    monthly: round2(monthly),
    annual: round2(monthly * 12),
    accumulated: round2(accumulated),
    bookValue: round2(bookValue),
    pctDepreciated: base > 0 ? Math.round((accumulated / base) * 1000) / 10 : 0,
    monthsElapsed: Math.round(monthsElapsed * 10) / 10,
    remainingMonths: Math.round(remainingMonths * 10) / 10,
    fullyDepreciated: monthsElapsed >= life,
  };
}

/** The book value alone, or null if depreciation isn't configured. */
export function assetBookValue(input: DepreciationInput, asOf: Date = new Date()): number | null {
  return computeDepreciation(input, asOf)?.bookValue ?? null;
}

/**
 * Infer the useful life (in months) from an asset's cost and its known current
 * value — "calculate the depreciation from initial and current value". Assumes
 * straight-line to the salvage value: given how much it has lost over the months
 * since `start`, extrapolate how long it takes to reach salvage.
 *
 * Returns null when the inputs can't yield a sensible life (no loss yet, no time
 * elapsed, or current ≥ cost).
 */
export function deriveUsefulLifeMonths(
  args: {
    acquiredValue: number;
    currentValue: number;
    salvageValue?: number;
    start: string | null;
  },
  asOf: Date = new Date(),
): number | null {
  const { acquiredValue, currentValue } = args;
  const salvage = Math.max(0, Math.min(args.salvageValue || 0, acquiredValue));
  if (!args.start || acquiredValue <= 0 || currentValue >= acquiredValue) return null;
  const monthsElapsed = monthsBetween(args.start, asOf);
  if (monthsElapsed <= 0) return null;
  const lostPerMonth = (acquiredValue - currentValue) / monthsElapsed;
  if (lostPerMonth <= 0) return null;
  const totalMonths = (acquiredValue - salvage) / lostPerMonth;
  const rounded = Math.round(totalMonths);
  return rounded > 0 ? rounded : null;
}
