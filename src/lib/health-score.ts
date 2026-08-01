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
  key:
    | "savings"
    | "emergency"
    | "debt"
    | "budget"
    | "networth"
    // Business pillars
    | "cashflow"
    | "runway"
    | "diversification"
    | "productivity"
    | "equity";
  value: number;
};

export type Badge =
  | "emergency_ready"
  | "debt_slayer"
  | "consistent_saver"
  | "budget_hero"
  | "investing"
  | "net_worth_positive"
  | "getting_started"
  // Business badges
  | "fcf_positive"
  | "strong_runway"
  | "diversified"
  | "productive"
  | "low_leverage"
  | "equity_positive"
  | "active";

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
  const savingsRaw = clamp(100 * Math.sqrt(Math.min(1, savedRate / 0.2)));
  // A just-started cycle hasn't had time to fund projects, so the raw figure is
  // unreliable early on. Ease from a neutral 55 toward the real number as the
  // cycle elapses (mirrors the budget pillar), so the headline doesn't crater on
  // day one of a new cycle. Full weight by ~40% elapsed.
  const savingsConfidence = Math.min(1, cycleProgress / 0.4);
  const savings = clamp(55 + (savingsRaw - 55) * savingsConfidence);
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

// ---------------------------------------------------------------------------
// Business health — a different scorecard for company spaces
// ---------------------------------------------------------------------------
// Companies are judged on the things that make a business durable rather than a
// household's savings discipline: does it throw off free cash flow, does it hold
// a runway, is its revenue diversified (many sources / many clients), is it
// productive per head, is it lightly leveraged, and does it hold positive equity.
// Everything stays ratio-based so the snapshot is still safe to share.

export type BusinessScoreInputs = {
  /** Monthly revenue (recurring income). */
  revenueMonthly: number;
  /** Monthly operating cash flow = revenue − running costs (fixed + variable + debt). */
  operatingCashFlow: number;
  /** Accessible cash reserve (project balances + quickly-sellable assets). */
  reserve: number;
  /** Total monthly outgoings the reserve has to cover. */
  monthlyOutgoings: number;
  /** Monthly debt servicing. */
  debtMonthly: number;
  /** Equity = assets + reserves − debt owed. */
  netWorth: number;
  hasNetWorthData: boolean;
  /** Monthly amounts of each income source (to gauge concentration). */
  incomeSources: number[];
  /** Distinct payers/clients seen in receipts this cycle. */
  distinctClients: number;
  /** Number of employees (0 = solo/owner-run). */
  employees: number;
  /** Whether the business tracks any projects/reserves. */
  hasProjects: boolean;
  /** Transactions logged this cycle — a liveliness signal. */
  activityCount: number;
};

/** Effective number of income streams via the inverse Herfindahl index. */
function effectiveSources(amounts: number[]): number {
  const pos = amounts.filter((a) => a > 0);
  const total = pos.reduce((s, a) => s + a, 0);
  if (total <= 0) return 0;
  const hhi = pos.reduce((s, a) => s + (a / total) ** 2, 0);
  return hhi > 0 ? 1 / hhi : 0;
}

export function computeBusinessHealth(input: BusinessScoreInputs): HealthResult {
  const {
    revenueMonthly,
    operatingCashFlow,
    reserve,
    monthlyOutgoings,
    debtMonthly,
    netWorth,
    hasNetWorthData,
    incomeSources,
    distinctClients,
    employees,
    hasProjects,
    activityCount,
  } = input;

  // --- Free cash flow margin. 25% margin = 100; negative = 0 (burning cash). ---
  const fcfMargin = revenueMonthly > 0 ? operatingCashFlow / revenueMonthly : 0;
  const cashflow = clamp(100 * Math.sqrt(Math.min(1, Math.max(0, fcfMargin) / 0.25)));

  // --- Runway: months of outgoings the reserve covers. 6 months = 100. --------
  const outgoings = Math.max(1, monthlyOutgoings);
  const runwayMonths = reserve / outgoings;
  const runway = clamp(100 * Math.sqrt(Math.min(1, runwayMonths / 6)));

  // --- Debt burden: debt service vs revenue. 0% = 100, 40% = 0. ---------------
  const debtRatio = revenueMonthly > 0 ? debtMonthly / revenueMonthly : 0;
  const debt = clamp(100 - debtRatio * 250);

  // --- Diversification: balanced income streams + a spread of clients. --------
  // Concentrated revenue (one client / one stream) is the classic small-business
  // risk, so this pillar rewards spreading it out.
  const effN = effectiveSources(incomeSources);
  const sourcesScore = 100 * Math.sqrt(Math.min(1, Math.max(0, effN - 1) / 3)); // 1→0, 4+→100
  const clientsScore = 100 * Math.sqrt(Math.min(1, distinctClients / 5)); // 5+ clients → 100
  const diversification = clamp(0.6 * sourcesScore + 0.4 * clientsScore);

  // --- Productivity: annual revenue per head. ~€100k/employee ≈ strong. --------
  // Sector-dependent, so it's a gentle encouraging curve, not a hard benchmark.
  const heads = Math.max(1, employees || 0);
  const revenuePerEmployeeAnnual = (revenueMonthly * 12) / heads;
  const productivity = clamp(100 * Math.sqrt(Math.min(1, revenuePerEmployeeAnnual / 100_000)));

  // --- Equity: net worth as a multiple of annual revenue (same shape as HH). --
  const annualRevenue = Math.max(1, revenueMonthly * 12);
  const nwMult = netWorth / annualRevenue;
  let equityScore: number;
  if (nwMult >= 6) equityScore = 100;
  else if (nwMult >= 3) equityScore = 85 + 5 * (nwMult - 3);
  else if (nwMult >= 1) equityScore = 60 + 12.5 * (nwMult - 1);
  else if (nwMult >= 0) equityScore = 30 + 30 * nwMult;
  else if (nwMult > -1) equityScore = 30 * (1 + nwMult);
  else equityScore = 0;
  equityScore = clamp(equityScore);
  const equityScored = hasNetWorthData;

  const scores: SubScore[] = [
    { key: "cashflow", value: Math.round(cashflow) },
    { key: "runway", value: Math.round(runway) },
    { key: "diversification", value: Math.round(diversification) },
    { key: "productivity", value: Math.round(productivity) },
    { key: "debt", value: Math.round(debt) },
  ];
  if (equityScored) scores.push({ key: "equity", value: Math.round(equityScore) });

  // Free cash flow is the heart of a business, so it carries the most weight;
  // the overall still leans on the weakest pillar so one soft spot shows.
  const agg = [cashflow, runway, diversification, productivity, debt, ...(equityScored ? [equityScore] : [])];
  const mean = agg.reduce((s, v) => s + v, 0) / agg.length;
  const weakest = Math.min(...agg);
  // Extra weight on cash flow — a profitable, cash-generative company scores well
  // even if a secondary pillar lags.
  const overall = clamp(Math.round(0.5 * mean + 0.3 * cashflow + 0.2 * weakest));

  const badges: Badge[] = [];
  if (fcfMargin > 0) badges.push("fcf_positive");
  if (runwayMonths >= 3) badges.push("strong_runway");
  if (diversification >= 60) badges.push("diversified");
  if (productivity >= 60) badges.push("productive");
  if (debtRatio < 0.2) badges.push("low_leverage");
  if (netWorth > 0) badges.push("equity_positive");
  if (hasProjects && activityCount > 0) badges.push("active");
  if (badges.length === 0) badges.push("getting_started");

  return {
    overall,
    scores,
    badges,
    monthsOfEmergency: Math.round(runwayMonths * 10) / 10,
    savingsRate: Math.round(Math.max(0, fcfMargin) * 100) / 100,
    debtRatio: Math.round(debtRatio * 100) / 100,
  };
}
