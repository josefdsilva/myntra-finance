// Privacy-safe household financial-health scoring.
//
// Every score is bounded 0-100 and derived only from ratios (never raw amounts)
// so the resulting snapshot can be shared publicly without leaking income,
// balances, or debt levels. The four sub-scores map to the concepts a user can
// influence: saving, debt burden, emergency preparedness, and monthly discipline.

export type ScoreInputs = {
  /** Monthly recurring income. */
  income: number;
  /** Real money set aside into projects this cycle (confirmed allocations +
   * net deposits into projects). This is actual saving, not leftover surplus. */
  savedThisCycle: number;
  /** Monthly fixed expenses + monthly debt payments. */
  fixedTotal: number;
  /** Monthly debt payments only. */
  debtMonthly: number;
  /** Sum of current balances across all buckets/projects. */
  bucketsTotal: number;
  /** Current value of quickly-sellable assets (stocks, bonds, funds) — a real,
   * if secondary, emergency backstop on top of project balances. */
  liquidAssets: number;
  /** Net worth = assets + project balances − outstanding loan balances. Scored as
   * its own pillar (a multiple of annual income) and drives the net-worth badge. */
  netWorth: number;
  /** Whether the household has enough recorded (assets, savings, or debt) for net
   * worth to be meaningful. When false, the net-worth pillar is not scored. */
  hasNetWorthData: boolean;
  /** Whether at least one bucket has kind = "investment". */
  hasInvestment: boolean;
  /** Variable pool for the current cycle (baseline - fixed). */
  variablePool: number;
  /** Net variable spend so far this cycle (spent - non-salary income). */
  variableSpent: number;
  /** Fraction of the cycle elapsed [0..1]. */
  cycleProgress: number;
};

export type SubScore = {
  key: "savings" | "emergency" | "debt" | "budget" | "networth";
  value: number;
};

export type Badge =
  | "emergency_ready"
  | "debt_slayer"
  | "consistent_saver"
  | "budget_hero"
  | "investing"
  | "net_worth_positive"
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
  const {
    income,
    savedThisCycle,
    fixedTotal,
    debtMonthly,
    bucketsTotal,
    liquidAssets,
    netWorth,
    hasNetWorthData,
    hasInvestment,
    variablePool,
    variableSpent,
    cycleProgress,
  } = input;

  // --- Ratios with honest denominators --------------------------------------
  // Savings = money actually moved into projects this cycle, not the leftover
  // after fixed costs (which most households have but never save).
  const savedRate = income > 0 ? Math.max(0, savedThisCycle) / income : 0;
  const debtRatio = income > 0 ? debtMonthly / income : 0;
  // Emergency runway is measured against TOTAL monthly outgoings (fixed +
  // everyday pool), not fixed costs alone — money you'd actually need to cover.
  // Accessible buffer = project balances + quickly-sellable assets (stocks,
  // bonds, funds); illiquid assets like a house are not a real emergency source.
  const totalOutgoings = Math.max(1, fixedTotal + Math.max(0, variablePool));
  const accessibleBuffer = bucketsTotal + Math.max(0, liquidAssets);
  const monthsOfEmergency = accessibleBuffer / totalOutgoings;

  // --- Sub-scores. sqrt curves are "encouraging": they reward early progress
  //     while still requiring a lot for a perfect mark. ------------------------
  // 20% real savings rate = 100; ~5% already reaches ~50.
  const savings = clamp(100 * Math.sqrt(Math.min(1, savedRate / 0.2)));
  // 6 months of total outgoings = 100; 3 months ≈ 71, 1 month ≈ 41.
  const emergency = clamp(100 * Math.sqrt(Math.min(1, monthsOfEmergency / 6)));
  // 0% debt-to-income = 100, 40% = 0.
  const debt = clamp(100 - debtRatio * 250);

  // Budget discipline: spend pace vs elapsed fraction. Only meaningful once the
  // household has everyday estimates AND some of the cycle has elapsed; until
  // then it stays a neutral 50 and is excluded from the overall (no free 100).
  const budgetScored = variablePool > 0;
  let budget = 50;
  if (budgetScored) {
    const expected = variablePool * cycleProgress;
    const drift = Math.abs(variableSpent - expected) / variablePool;
    const raw = clamp(100 - drift * 150);
    // Damp early-cycle certainty toward a neutral 60 until ~40% has elapsed.
    const confidence = Math.min(1, cycleProgress / 0.4);
    budget = clamp(60 + (raw - 60) * confidence);
  }

  // Net worth pillar: a stock, scored as a multiple of annual income. Negative
  // (underwater) scores low, zero is weak, and it climbs with wealth, saturating
  // around 6x annual income. Only scored once there's something to measure.
  const netWorthScored = hasNetWorthData;
  const annualIncome = Math.max(1, income * 12);
  const nwMult = netWorth / annualIncome;
  let netWorthScore: number;
  if (nwMult >= 6) netWorthScore = 100;
  else if (nwMult >= 3) netWorthScore = 85 + 5 * (nwMult - 3);
  else if (nwMult >= 1) netWorthScore = 60 + 12.5 * (nwMult - 1);
  else if (nwMult >= 0) netWorthScore = 30 + 30 * nwMult;
  else if (nwMult > -1) netWorthScore = 30 * (1 + nwMult);
  else netWorthScore = 0;
  netWorthScore = clamp(netWorthScore);

  const scores: SubScore[] = [
    { key: "savings", value: Math.round(savings) },
    { key: "emergency", value: Math.round(emergency) },
    { key: "debt", value: Math.round(debt) },
    { key: "budget", value: Math.round(budget) },
  ];
  if (netWorthScored) {
    scores.splice(3, 0, { key: "networth", value: Math.round(netWorthScore) });
  }

  // Overall blends the average with the weakest pillar so one genuinely weak
  // area drags the headline down without zeroing it out. Budget and net worth
  // only count once they are actually measurable.
  const agg = [
    savings,
    emergency,
    debt,
    ...(budgetScored ? [budget] : []),
    ...(netWorthScored ? [netWorthScore] : []),
  ];
  const mean = agg.reduce((s, v) => s + v, 0) / agg.length;
  const weakest = Math.min(...agg);
  const overall = clamp(Math.round(0.8 * mean + 0.2 * weakest));

  const badges: Badge[] = [];
  if (monthsOfEmergency >= 3) badges.push("emergency_ready");
  if (debtRatio < 0.15) badges.push("debt_slayer");
  if (savedRate >= 0.1) badges.push("consistent_saver");
  if (budgetScored && budget >= 80) badges.push("budget_hero");
  if (hasInvestment) badges.push("investing");
  if (netWorth > 0) badges.push("net_worth_positive");
  if (badges.length === 0) badges.push("getting_started");

  return {
    overall,
    scores,
    badges,
    monthsOfEmergency: Math.round(monthsOfEmergency * 10) / 10,
    savingsRate: Math.round(savedRate * 100) / 100,
    debtRatio: Math.round(debtRatio * 100) / 100,
  };
}
