// Small shared primitives for the money math, so the same helpers are not
// re-implemented across dashboards, snapshots, cron jobs and engines.

/** Sum monthly-normalised amounts from a set of rows (nullish-safe). */
export function sumMonthly(
  rows: Array<{ monthly_amount: number | string }> | null | undefined,
): number {
  return (rows ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
}

/**
 * Asset kinds that count as a liquid emergency backstop: cash and readily
 * sellable securities.
 *
 * NOTE: this means "liquid", not "invested". Do not reuse it to total
 * investments — finance statements track those under their own local set on
 * purpose (a cash balance is liquid but is not an investment).
 */
export const LIQUID_ASSET_KINDS: ReadonlySet<string> = new Set([
  "cash",
  "stocks",
  "bonds",
  "fund",
]);

export function isLiquidAsset(kind: string): boolean {
  return LIQUID_ASSET_KINDS.has(kind);
}
