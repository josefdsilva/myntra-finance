// Shared "which debt is the expensive one" logic. The dashboard tip and the
// Money Journey both need to agree on (a) where the high-interest line sits and
// (b) which loan to attack first, so that logic lives here once instead of being
// re-derived (and drifting) in two places.

/** At/above this APR a debt is "expensive" — credit-card territory, well above a
 *  typical secured/mortgage rate. Shared by the debt tip and the journey rung. */
export const HIGH_APR_PCT = 15;

type RateFields = {
  deduced_rate_pct?: number | string | null;
  tan_pct?: number | string | null;
  taeg_pct?: number | string | null;
};

type BalanceFields = {
  principal_remaining?: number | string | null;
  starting_principal?: number | string | null;
};

/**
 * Effective APR for a debt — the deduced (solved) rate first, then the nominal
 * TAN, then the user-entered TAEG reference. Mirrors `debtMonthlyRate`'s
 * preference order so every surface ranks debts the same way.
 */
export function aprOf(d: RateFields): number {
  if (d.deduced_rate_pct != null) return Number(d.deduced_rate_pct);
  if (d.tan_pct != null) return Number(d.tan_pct);
  if (d.taeg_pct != null) return Number(d.taeg_pct);
  return 0;
}

/** Live-ish balance of a debt from stored principal (no schedule math needed). */
export function debtBalance(d: BalanceFields): number {
  return Number(d.principal_remaining ?? d.starting_principal ?? 0);
}

export type PriceyDebt<T> = {
  debt: T;
  apr: number;
  balance: number;
  /** True when this loan is also the smallest balance — avalanche and snowball
   *  agree, so "clear it first" is unambiguous. */
  isSmallestBalance: boolean;
};

/**
 * The single most expensive debt worth attacking: highest APR, with a real
 * balance, at or above the high-interest line. Returns null when none qualifies.
 * Also reports whether that same loan is the smallest balance among all debts.
 */
export function priciestHighAprDebt<T extends RateFields & BalanceFields>(
  debts: T[],
): PriceyDebt<T> | null {
  const withBalance = debts.filter((d) => debtBalance(d) > 0);
  let best: { debt: T; apr: number; balance: number } | null = null;
  for (const d of withBalance) {
    const apr = aprOf(d);
    if (apr < HIGH_APR_PCT) continue;
    const balance = debtBalance(d);
    if (!best || apr > best.apr) best = { debt: d, apr, balance };
  }
  if (!best) return null;
  const smallest = withBalance.reduce(
    (min, d) => Math.min(min, debtBalance(d)),
    Infinity,
  );
  return { ...best, isSmallestBalance: best.balance <= smallest + 0.01 };
}
