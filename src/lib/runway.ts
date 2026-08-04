// Pure SME runway math. Runway is how many months the business can keep going
// on its current cash if nothing else changes. Deterministic and unit-tested;
// the server fn gathers the numbers and calls this.

export type RunwaySeverity = "ok" | "warn" | "critical";

export type RunwayResult = {
  cashOnHand: number;
  /** Net monthly cash burn = outgoings above income (0 when cash-flow positive). */
  monthlyBurn: number;
  cashFlowPositive: boolean;
  /** Months of runway, or null when cash-flow positive (not burning). */
  months: number | null;
  severity: RunwaySeverity;
};

/**
 * Resolve the cash figure to use: the owner's manual override when set,
 * otherwise the computed estimate (liquid assets).
 */
export function resolveCashOnHand(p: { override: number | null; computed: number }): number {
  return p.override != null ? p.override : p.computed;
}

export function computeRunway(p: {
  cashOnHand: number;
  monthlyOutgoings: number;
  monthlyIncome: number;
}): RunwayResult {
  const burn = Math.max(0, p.monthlyOutgoings - p.monthlyIncome);
  if (burn <= 0) {
    return {
      cashOnHand: p.cashOnHand,
      monthlyBurn: 0,
      cashFlowPositive: true,
      months: null,
      severity: "ok",
    };
  }
  const months = p.cashOnHand / burn;
  const severity: RunwaySeverity = months < 1 ? "critical" : months < 3 ? "warn" : "ok";
  return {
    cashOnHand: p.cashOnHand,
    monthlyBurn: burn,
    cashFlowPositive: false,
    months,
    severity,
  };
}
