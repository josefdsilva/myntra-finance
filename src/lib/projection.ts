/**
 * Forward projection — "fast forward to a date". Pure and deterministic.
 *
 * Given today's position (income, everyday + fixed costs, debts with their
 * amortization, known plans, savings and assets), roll it forward month by month
 * to estimate the household's (or business's) financial position at a future
 * date, assuming things unfold normally.
 *
 * What a naive "surplus × months" misses, and this models:
 *  - Debts amortize; when a loan is paid off its payment STOPS, so surplus rises.
 *  - Plans (one-off or recurring, income or spend) land on their own month.
 *  - Surplus accumulates into liquid savings and hence net worth.
 *  - Nominal knobs (asset growth, income growth, expense inflation, a spend
 *    buffer) drive an expected / cautious / optimistic range.
 *
 * It emits several lenses per month (surplus, savings, debt remaining, assets,
 * net worth) plus, separately, how each project fills if funding continues. This
 * is the backbone for the scenario simulator: a scenario is just a modified input.
 */

import { addMonths } from "date-fns";
import { monthKey, plansForMonth, type Plan } from "./plan";

/** Cap the horizon — beyond ~2-3 years the assumptions swamp the signal. */
export const MAX_PROJECTION_MONTHS = 36;

/** A debt reduced to the three numbers amortization needs. */
export type ProjectionDebt = {
  label: string;
  /** Balance owed today. */
  balance: number;
  /** Monthly interest rate as a fraction (e.g. 0.004 ≈ 5% APR). */
  monthlyRate: number;
  /** The regular monthly installment. */
  installment: number;
};

export type ProjectionInput = {
  /** First projected month (usually today). */
  startMonth: Date;
  /** How many months to project (clamped to MAX_PROJECTION_MONTHS). */
  months: number;
  /** Recurring net income per month. */
  monthlyIncome: number;
  /** Fixed monthly costs EXCLUDING debt (debts are amortized separately). */
  fixedNonDebtMonthly: number;
  /** Everyday variable spending estimate per month. */
  variableMonthly: number;
  debts: ProjectionDebt[];
  /** Future costs/income the household already knows about. */
  plans: Plan[];
  /** Liquid money already set aside today (project/savings balances). */
  startingSavings: number;
  /** Current value of non-cash assets (property, vehicles, investments…). */
  assetsTotal: number;
  /** Nominal annual assumptions; all default to 0 (flat). */
  assetGrowthAnnualPct?: number;
  incomeGrowthAnnualPct?: number;
  expenseInflationAnnualPct?: number;
  /** Flat % added to everyday spend as a cushion (e.g. 10 = spend 10% more). */
  spendBufferPct?: number;
};

export type ProjectionMonth = {
  ym: string;
  /** Recurring income + any income plans landing this month. */
  income: number;
  /** Everyday + fixed costs + planned one-off spend this month (excludes debt). */
  expenses: number;
  /** Total debt payments made this month (falls as loans pay off). */
  debtPaid: number;
  /** income − expenses − debtPaid (negative = drawing down). */
  surplus: number;
  /** Cumulative liquid savings / cash after this month. */
  savings: number;
  /** Total debt principal still owed after this month. */
  debtRemaining: number;
  /** Value of assets this month (grown if a growth rate is set). */
  assets: number;
  /** assets + savings − debtRemaining. */
  netWorth: number;
  /** True once every debt is paid off. */
  debtFree: boolean;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Annual percent → per-month growth fraction. */
function monthlyGrowth(annualPct: number): number {
  if (!annualPct) return 0;
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

const clampMonths = (m: number) => Math.max(1, Math.min(MAX_PROJECTION_MONTHS, Math.round(m)));

/**
 * Roll the pooled position forward. Returns one row per month (the first row is
 * the state after the first projected month).
 */
export function projectForward(input: ProjectionInput): ProjectionMonth[] {
  const {
    startMonth,
    monthlyIncome,
    fixedNonDebtMonthly,
    variableMonthly,
    plans,
    startingSavings,
    assetsTotal,
  } = input;
  const months = clampMonths(input.months);

  const gIncome = monthlyGrowth(input.incomeGrowthAnnualPct ?? 0);
  const gExpense = monthlyGrowth(input.expenseInflationAnnualPct ?? 0);
  const gAsset = monthlyGrowth(input.assetGrowthAnnualPct ?? 0);
  const spendMult = 1 + (input.spendBufferPct ?? 0) / 100;

  // Mutable debt balances we amortize as we go.
  const debts = input.debts.map((d) => ({ ...d, balance: Math.max(0, Number(d.balance) || 0) }));

  let savings = Number(startingSavings) || 0;
  const out: ProjectionMonth[] = [];

  for (let i = 0; i < months; i += 1) {
    const date = addMonths(startMonth, i + 1);
    const ym = monthKey(date);
    const factorIncome = Math.pow(1 + gIncome, i + 1);
    const factorExpense = Math.pow(1 + gExpense, i + 1);
    const factorAsset = Math.pow(1 + gAsset, i + 1);

    const monthPlans = plansForMonth(plans, ym);
    let planIncome = 0;
    let planSpend = 0;
    for (const p of monthPlans) {
      const amt = Math.abs(Number(p.amount) || 0);
      if (p.direction === "income") planIncome += amt;
      else planSpend += amt;
    }

    const income = monthlyIncome * factorIncome + planIncome;
    const everyday = (fixedNonDebtMonthly + variableMonthly) * factorExpense * spendMult;

    // Amortize each debt one step: interest first, then principal.
    let debtPaid = 0;
    for (const d of debts) {
      if (d.balance <= 0) continue;
      const interest = d.balance * d.monthlyRate;
      const pay = Math.min(d.installment, d.balance + interest);
      d.balance = Math.max(0, d.balance + interest - pay);
      debtPaid += pay;
    }

    const expenses = everyday + planSpend;
    const surplus = income - expenses - debtPaid;
    savings += surplus;

    const debtRemaining = debts.reduce((s, d) => s + d.balance, 0);
    const assets = assetsTotal * factorAsset;
    const netWorth = assets + savings - debtRemaining;

    out.push({
      ym,
      income: round2(income),
      expenses: round2(expenses),
      debtPaid: round2(debtPaid),
      surplus: round2(surplus),
      savings: round2(savings),
      debtRemaining: round2(debtRemaining),
      assets: round2(assets),
      netWorth: round2(netWorth),
      debtFree: debtRemaining <= 0.01,
    });
  }

  return out;
}

/** The projected position at (or just before) `target`, or null if before start. */
export function positionAt(input: ProjectionInput, target: Date): ProjectionMonth | null {
  const targetYm = monthKey(target);
  let picked: ProjectionMonth | null = null;
  for (const m of projectForward(input)) {
    if (m.ym <= targetYm) picked = m;
    else break;
  }
  return picked;
}

/** Whole calendar months between two dates (min 0). */
export function monthsBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()));
}

/** The first month cash/savings goes negative — a runway signal for businesses. */
export function runwayMonths(series: ProjectionMonth[]): number | null {
  const idx = series.findIndex((m) => m.savings < 0);
  return idx === -1 ? null : idx + 1;
}

// ---- Scenario range (expected / cautious / optimistic) --------------------

export type ScenarioKey = "expected" | "cautious" | "optimistic";

type ScenarioAssumptions = Pick<
  ProjectionInput,
  "assetGrowthAnnualPct" | "incomeGrowthAnnualPct" | "expenseInflationAnnualPct" | "spendBufferPct"
>;

/**
 * Deterministic assumption sets. "expected" is flat (today carried forward);
 * cautious and optimistic bracket it. Not statistical CIs — an honest range.
 */
export const DEFAULT_SCENARIOS: Record<ScenarioKey, ScenarioAssumptions> = {
  expected: {
    incomeGrowthAnnualPct: 0,
    expenseInflationAnnualPct: 0,
    assetGrowthAnnualPct: 0,
    spendBufferPct: 0,
  },
  cautious: {
    incomeGrowthAnnualPct: 0,
    expenseInflationAnnualPct: 4,
    assetGrowthAnnualPct: -2,
    spendBufferPct: 8,
  },
  optimistic: {
    incomeGrowthAnnualPct: 2,
    expenseInflationAnnualPct: 1,
    assetGrowthAnnualPct: 3,
    spendBufferPct: -5,
  },
};

/** Run the projection under all three scenarios; returns each labelled series. */
export function projectScenarios(
  base: ProjectionInput,
  scenarios: Record<ScenarioKey, ScenarioAssumptions> = DEFAULT_SCENARIOS,
): Record<ScenarioKey, ProjectionMonth[]> {
  const run = (a: ScenarioAssumptions) => projectForward({ ...base, ...a });
  return {
    expected: run(scenarios.expected),
    cautious: run(scenarios.cautious),
    optimistic: run(scenarios.optimistic),
  };
}

// ---- Per-project forward funding ------------------------------------------

export type ProjectionProject = {
  id: string;
  name: string;
  /** Balance today. */
  balance: number;
  /** Monthly contribution the project receives at its current target/pace. */
  monthlyContribution: number;
  /** For finish-line goals: the target balance (else null for ongoing). */
  goalTarget?: number | null;
  /** For finish-line goals: months until the deadline (else null). */
  monthsToGoal?: number | null;
};

export type ProjectedProject = {
  id: string;
  name: string;
  startBalance: number;
  projectedBalance: number;
  /** True when a finish-line goal is reached within the horizon. */
  reachedGoal: boolean;
};

/**
 * "How your projects look if you keep funding them." Each project fills at its
 * current contribution; a finish-line goal stops at its target (and no later
 * than its deadline). This is a breakdown of the same saved money, so it never
 * contradicts net worth — it just shows where it's earmarked.
 */
export function projectProjects(
  projects: ProjectionProject[],
  months: number,
): ProjectedProject[] {
  const n = clampMonths(months);
  return projects.map((p) => {
    const contribution = Math.max(0, Number(p.monthlyContribution) || 0);
    const hasGoal = p.goalTarget != null && p.goalTarget > 0;
    const fundingMonths =
      hasGoal && p.monthsToGoal != null ? Math.min(n, Math.max(0, p.monthsToGoal)) : n;
    const raw = (Number(p.balance) || 0) + contribution * fundingMonths;
    const projectedBalance = hasGoal ? Math.min(Number(p.goalTarget), raw) : raw;
    return {
      id: p.id,
      name: p.name,
      startBalance: round2(Number(p.balance) || 0),
      projectedBalance: round2(projectedBalance),
      reachedGoal: hasGoal ? projectedBalance >= Number(p.goalTarget) - 0.01 : false,
    };
  });
}
