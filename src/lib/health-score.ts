// Privacy-safe household financial-health scoring.
//
// Every score is bounded 0-100 and derived only from ratios (never raw amounts)
// so the resulting snapshot can be shared publicly without leaking income,
// balances, or debt levels. The four sub-scores map to the concepts a user can
// influence: saving, debt burden, emergency preparedness, and monthly discipline.

export type ScoreInputs = {
  /** Monthly recurring income. */
  income: number;
  /** Monthly fixed expenses + monthly debt payments. */
  fixedTotal: number;
  /** Monthly debt payments only. */
  debtMonthly: number;
  /** Sum of current balances across all buckets/projects. */
  bucketsTotal: number;
  /** Whether at least one bucket has kind = "investment". */
  hasInvestment: boolean;
  /** Variable pool for the current cycle (baseline - fixed). */
  variablePool: number;
  /** Net variable spend so far this cycle (spent - non-salary income). */
  variableSpent: number;
  /** Fraction of the cycle elapsed [0..1]. */
  cycleProgress: number;
};

export type SubScore = { key: "savings" | "emergency" | "debt" | "budget"; value: number };

export type Badge =
  | "emergency_ready"
  | "debt_slayer"
  | "consistent_saver"
  | "budget_hero"
  | "investing"
  | "getting_started";

export type HealthResult = {
  overall: number;
  scores: SubScore[];
  badges: Badge[];
  monthsOfEmergency: number;
  savingsRate: number;
  debtRatio: number;
};

function clamp(n: number, lo = 0, hi = 100): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

export function computeHealth(input: ScoreInputs): HealthResult {
  const { income, fixedTotal, debtMonthly, bucketsTotal, hasInvestment, variablePool, variableSpent, cycleProgress } = input;

  const surplus = Math.max(0, income - fixedTotal);
  const savingsRate = income > 0 ? surplus / income : 0;
  const debtRatio = income > 0 ? debtMonthly / income : 0;
  const fixedMonthly = Math.max(1, fixedTotal); // avoid div/0
  const monthsOfEmergency = bucketsTotal / fixedMonthly;

  // 20% savings rate = perfect
  const savings = clamp(savingsRate * 500);
  // 3 months of fixed costs covered = perfect
  const emergency = clamp((monthsOfEmergency / 3) * 100);
  // 0% debt = 100, 40% debt = 0
  const debt = clamp(100 - debtRatio * 250);
  // Compare pace of spend vs cycle progress. Perfect when spending pace matches
  // elapsed fraction; penalise both wild under- and overspending equally.
  let budget = 100;
  if (variablePool > 0) {
    const expected = variablePool * cycleProgress;
    const drift = Math.abs(variableSpent - expected) / variablePool;
    budget = clamp(100 - drift * 150);
  }

  const scores: SubScore[] = [
    { key: "savings", value: Math.round(savings) },
    { key: "emergency", value: Math.round(emergency) },
    { key: "debt", value: Math.round(debt) },
    { key: "budget", value: Math.round(budget) },
  ];

  const overall = Math.round(scores.reduce((s, x) => s + x.value, 0) / scores.length);

  const badges: Badge[] = [];
  if (monthsOfEmergency >= 3) badges.push("emergency_ready");
  if (debtRatio < 0.15) badges.push("debt_slayer");
  if (savingsRate >= 0.15) badges.push("consistent_saver");
  if (budget >= 80) badges.push("budget_hero");
  if (hasInvestment) badges.push("investing");
  if (badges.length === 0) badges.push("getting_started");

  return {
    overall,
    scores,
    badges,
    monthsOfEmergency: Math.round(monthsOfEmergency * 10) / 10,
    savingsRate: Math.round(savingsRate * 100) / 100,
    debtRatio: Math.round(debtRatio * 100) / 100,
  };
}
