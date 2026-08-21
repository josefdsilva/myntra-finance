// Privacy-safe household financial-health scoring.
//
// Every score is bounded 0-100 and derived only from ratios (never raw amounts)
// so the resulting snapshot can be shared publicly without leaking income,
// balances, or debt levels. The four sub-scores map to the concepts a user can
// influence: saving, debt burden, emergency preparedness, and monthly discipline.

export type ScoreInputs = {
  /** Monthly recurring income. */
  income: number;
  /** Monthly amount of each income source (to gauge concentration/resilience). */
  incomeSources: number[];
  /** 1-99 percentile of the household's equivalised income vs the country's
   * income deciles. null when there's no benchmark for the country. Leak-free:
   * only the relative position is used, never the amount. */
  incomePercentile: number | null;
  /** Monthly fixed expenses + monthly debt payments. */
  fixedTotal: number;
  /** Monthly debt payments only. */
  debtMonthly: number;
  /** Sum of current balances across all buckets/projects. */
  bucketsTotal: number;
  /** Current value of quickly-sellable assets (stocks, bonds, funds) — a real,
   * if secondary, emergency backstop on top of project balances. */
  liquidAssets: number;
  /** Money that is actually invested (investment-kind projects + liquid assets).
   * Used to reward deploying a surplus beyond the emergency buffer. */
  investedAmount: number;
  /** Net worth = assets + project balances − outstanding loan balances. */
  netWorth: number;
  /** Whether there's enough recorded for net worth to be meaningful. */
  hasNetWorthData: boolean;
  /** Whether at least one bucket has kind = "investment". */
  hasInvestment: boolean;
  /** Average funded fraction [0..1] across projects that have a target; null when
   * no project carries a target (funding-consistency pillar not scored). */
  fundedFraction: number | null;
  /** nice-to-have + treat share of variable spend this cycle [0..1]; null when
   * there's too little tagged spend to judge (consumption quality half not scored). */
  superfluousShare: number | null;
  /** Variable pool for the current cycle (baseline - fixed). */
  variablePool: number;
  /** Net variable spend so far this cycle (spent - non-salary income). */
  variableSpent: number;
  /** Fraction of the cycle elapsed [0..1]. */
  cycleProgress: number;
};

export type SubScore = {
  key:
    | "income"
    | "consumption"
    | "deploy"
    | "funding"
    | "savings"
    | "emergency"
    | "debt"
    | "budget"
    | "networth";
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

/**
 * Funding-consistency fraction [0..1] across projects that carry a target, or
 * null when none do. A `goal_by_date` project whose deadline is still in the
 * future counts as "on plan" (fraction 1), so adding a realistic long-term goal
 * never drags the score BELOW simply having no goal at all — the perverse result
 * of the old balance ÷ final-target rule, which read a €500-toward-€30k-by-2040
 * goal as ~2% funded. Only an overdue, still-unmet goal is marked down by how
 * far it fell short. Recurring targets (fixed monthly/yearly, % of surplus) keep
 * comparing balance to the target directly.
 */
export function projectFundedFraction(
  buckets: Array<{
    id: string;
    target_type?: string | null;
    target_value: number | string;
    target_deadline?: string | null;
  }>,
  balances: Record<string, number>,
  now: Date = new Date(),
): number | null {
  const targeted = buckets.filter((b) => Number(b.target_value) > 0);
  if (!targeted.length) return null;
  const nowMs = now.getTime();
  let sum = 0;
  for (const b of targeted) {
    const bal = Math.max(0, balances[b.id] ?? 0);
    const target = Math.max(1, Number(b.target_value));
    if (b.target_type === "goal_by_date" && b.target_deadline) {
      const overdue = new Date(b.target_deadline).getTime() < nowMs;
      sum += bal >= target || !overdue ? 1 : Math.min(1, bal / target);
    } else {
      sum += Math.min(1, bal / target);
    }
  }
  return sum / targeted.length;
}

/** Effective number of income streams via the inverse Herfindahl index. */
function effectiveSources(amounts: number[]): number {
  const pos = amounts.filter((a) => a > 0);
  const total = pos.reduce((s, a) => s + a, 0);
  if (total <= 0) return 0;
  const hhi = pos.reduce((s, a) => s + (a / total) ** 2, 0);
  return hhi > 0 ? 1 / hhi : 0;
}

export function computeHealth(input: ScoreInputs): HealthResult {
  const {
    income,
    incomeSources,
    incomePercentile,
    fixedTotal,
    debtMonthly,
    bucketsTotal,
    liquidAssets,
    investedAmount,
    netWorth,
    hasNetWorthData,
    hasInvestment,
    fundedFraction,
    superfluousShare,
    variablePool,
    cycleProgress,
  } = input;

  const outgoings = Math.max(1, fixedTotal + Math.max(0, variablePool));
  const accessibleBuffer = bucketsTotal + Math.max(0, liquidAssets);
  const monthsOfEmergency = accessibleBuffer / outgoings;
  const debtRatio = income > 0 ? debtMonthly / income : 0;
  // Headroom = share of income not consumed by outgoings; drives the reported
  // savingsRate + badge and anchors the consumption pillar.
  const headroom = income > 0 ? (income - outgoings) / income : 0;

  // 1. INCOME — resilience of sources + where the income sits vs peers. A single
  //    income is normal for a household (~60 baseline); extra balanced sources
  //    lift it, and the percentile adds the "higher income helps" signal, using
  //    only the relative position so no amount leaks.
  const effN = effectiveSources(incomeSources);
  const sourcesScore = clamp(60 + 40 * Math.sqrt(Math.min(1, Math.max(0, effN - 1) / 2)));
  const incomeScore =
    incomePercentile != null
      ? clamp(0.5 * sourcesScore + 0.5 * clamp(incomePercentile))
      : sourcesScore;

  // 2. CONSUMPTION — living within income + quality of spend. Consuming below
  //    income (room to save) scores high; at income is weak; above income (a
  //    deficit) drops toward 0. The superfluous (nice-to-have + treat) share
  //    refines it, damped early-cycle until there's enough tagged spend.
  const consRatio = income > 0 ? outgoings / income : 1.5;
  let within: number;
  if (consRatio <= 0.6) within = 100;
  else if (consRatio <= 1) within = 100 - ((consRatio - 0.6) / 0.4) * 55; // 1.0 → 45
  else within = 45 - Math.min(1, (consRatio - 1) / 0.2) * 45; // ≥1.2 → 0
  within = clamp(within);
  let consumption = within;
  if (superfluousShare != null) {
    const rawS = clamp(100 - superfluousShare * 130); // 0 → 100, ~0.5 → ~35
    const conf = Math.min(1, cycleProgress / 0.4);
    const superScore = clamp(60 + (rawS - 60) * conf);
    consumption = clamp(0.6 * within + 0.4 * superScore);
  }

  // 3. EMERGENCY BUFFER — months of outgoings covered. 3mo decent, 6mo strong,
  //    9mo full.
  const emergency = clamp(100 * Math.sqrt(Math.min(1, monthsOfEmergency / 9)));

  // 4. DEPLOY SURPLUS — only once a full buffer exists (≥6 months); a large idle
  //    cash pile beyond that is sub-optimal, so reward investing the excess.
  const deployScored = monthsOfEmergency >= 6;
  const investedShare =
    accessibleBuffer > 0 ? Math.min(1, Math.max(0, investedAmount) / accessibleBuffer) : 0;
  const deploy = clamp(30 + 70 * Math.sqrt(investedShare));

  // 5. DEBT — debt-to-income. 0% = 100, 40% = 0.
  const debt = clamp(100 - debtRatio * 250);

  // 6. FUNDING CONSISTENCY — progress toward project targets (a stock, so it's
  //    stable across the cycle). Only scored when a project carries a target.
  const fundingScored = fundedFraction != null;
  const funding = clamp(100 * (fundedFraction ?? 0));

  // 7. NET WORTH — a multiple of annual income (as before).
  const netWorthScored = hasNetWorthData;
  const annualIncome = Math.max(1, income * 12);
  const nwMult = netWorth / annualIncome;
  let networth: number;
  if (nwMult >= 6) networth = 100;
  else if (nwMult >= 3) networth = 85 + 5 * (nwMult - 3);
  else if (nwMult >= 1) networth = 60 + 12.5 * (nwMult - 1);
  else if (nwMult >= 0) networth = 30 + 30 * nwMult;
  else if (nwMult > -1) networth = 30 * (1 + nwMult);
  else networth = 0;
  networth = clamp(networth);

  const scores: SubScore[] = [
    { key: "income", value: Math.round(incomeScore) },
    { key: "consumption", value: Math.round(consumption) },
    { key: "emergency", value: Math.round(emergency) },
    { key: "debt", value: Math.round(debt) },
  ];
  if (fundingScored) scores.push({ key: "funding", value: Math.round(funding) });
  if (deployScored) scores.push({ key: "deploy", value: Math.round(deploy) });
  if (netWorthScored) scores.push({ key: "networth", value: Math.round(networth) });

  // The headline is now dominated by stable STOCKS (buffer, net worth, debt,
  // income), so a fresh cycle can't swing it; the weakest pillar still drags it
  // down so one soft spot shows.
  const agg = [
    incomeScore,
    consumption,
    emergency,
    debt,
    ...(fundingScored ? [funding] : []),
    ...(deployScored ? [deploy] : []),
    ...(netWorthScored ? [networth] : []),
  ];
  const mean = agg.reduce((s, v) => s + v, 0) / agg.length;
  const weakest = Math.min(...agg);
  const overall = clamp(Math.round(0.8 * mean + 0.2 * weakest));

  const badges: Badge[] = [];
  if (monthsOfEmergency >= 3) badges.push("emergency_ready");
  if (debtRatio < 0.15) badges.push("debt_slayer");
  if ((fundedFraction ?? 0) >= 0.5) badges.push("consistent_saver");
  if (hasInvestment) badges.push("investing");
  if (netWorth > 0) badges.push("net_worth_positive");
  if (badges.length === 0) badges.push("getting_started");

  return {
    overall,
    scores,
    badges,
    monthsOfEmergency: Math.round(monthsOfEmergency * 10) / 10,
    savingsRate: Math.round(Math.max(0, headroom) * 100) / 100,
    debtRatio: Math.round(debtRatio * 100) / 100,
  };
}

