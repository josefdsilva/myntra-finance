/**
 * Forward projection — "fast forward to a date" and the scenario simulator.
 * Pure and deterministic.
 *
 * Rolls today's position forward month by month, applying any number of dated
 * "what-if" events (a purchase, a new loan, an overpayment, a raise, a bonus…).
 * Everything is double-entry so net worth stays honest:
 *  - Debts amortize; when a loan is paid off its payment STOPS → surplus rises.
 *  - A new loan adds cash AND a liability (neutral at signing), then its
 *    installments reduce surplus.
 *  - An overpayment moves cash → debt (neutral now, frees future interest).
 *  - A purchase spends cash; if it's an asset it also adds to assets (neutral).
 *  - Plans and events land on their own month; recurring changes persist.
 *  - Nominal knobs (asset growth, income growth, inflation, spend buffer) drive
 *    an expected / cautious / optimistic range.
 */

import { addMonths } from "date-fns";
import { monthKey, plansForMonth, type Plan } from "./plan";
import { monthlyRateFromTaeg, installmentFor } from "./amortization";

/** Cap the horizon — beyond ~5 years the assumptions swamp the signal. */
export const MAX_PROJECTION_MONTHS = 60;

/** A debt reduced to what amortization needs. `id` lets events target it. */
export type ProjectionDebt = {
  id: string;
  label: string;
  balance: number;
  /** Monthly interest rate as a fraction (e.g. 0.004 ≈ 5% APR). */
  monthlyRate: number;
  installment: number;
};

/** A dated what-if. Month keys are "YYYY-MM". */
export type ScenarioEvent =
  | {
      id: string;
      kind: "one_off";
      direction: "income" | "expense";
      month: string;
      amount: number;
      label?: string;
    }
  | {
      id: string;
      kind: "recurring";
      direction: "income" | "expense";
      fromMonth: string;
      amount: number;
      label?: string;
    }
  | {
      id: string;
      kind: "loan";
      month: string;
      principal: number;
      aprPct: number;
      termMonths: number;
      label?: string;
    }
  | { id: string; kind: "overpay"; month: string; amount: number; targetDebtId: string; label?: string }
  | {
      id: string;
      kind: "asset_purchase";
      month: string;
      price: number;
      /** Value it adds to assets (defaults to price). */
      assetValue?: number;
      label?: string;
    };

export type ProjectionInput = {
  startMonth: Date;
  months: number;
  monthlyIncome: number;
  fixedNonDebtMonthly: number;
  variableMonthly: number;
  debts: ProjectionDebt[];
  plans: Plan[];
  startingSavings: number;
  assetsTotal: number;
  events?: ScenarioEvent[];
  assetGrowthAnnualPct?: number;
  incomeGrowthAnnualPct?: number;
  expenseInflationAnnualPct?: number;
  spendBufferPct?: number;
};

export type ProjectionMonth = {
  ym: string;
  income: number;
  expenses: number;
  debtPaid: number;
  surplus: number;
  savings: number;
  debtRemaining: number;
  assets: number;
  netWorth: number;
  debtFree: boolean;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function monthlyGrowth(annualPct: number): number {
  if (!annualPct) return 0;
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

const clampMonths = (m: number) => Math.max(1, Math.min(MAX_PROJECTION_MONTHS, Math.round(m)));

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
  const events = input.events ?? [];

  const gIncome = monthlyGrowth(input.incomeGrowthAnnualPct ?? 0);
  const gExpense = monthlyGrowth(input.expenseInflationAnnualPct ?? 0);
  const gAsset = monthlyGrowth(input.assetGrowthAnnualPct ?? 0);
  const spendMult = 1 + (input.spendBufferPct ?? 0) / 100;

  // Active debts we amortize; loans add to this map on their month.
  const debts = new Map<string, { balance: number; monthlyRate: number; installment: number }>();
  for (const d of input.debts) {
    debts.set(d.id, {
      balance: Math.max(0, Number(d.balance) || 0),
      monthlyRate: d.monthlyRate,
      installment: d.installment,
    });
  }

  let savings = Number(startingSavings) || 0;
  let assetsAdded = 0; // from asset-purchase events (held flat)
  const out: ProjectionMonth[] = [];

  for (let i = 0; i < months; i += 1) {
    const date = addMonths(startMonth, i + 1);
    const ym = monthKey(date);
    const fI = Math.pow(1 + gIncome, i + 1);
    const fE = Math.pow(1 + gExpense, i + 1);
    const fA = Math.pow(1 + gAsset, i + 1);

    // Real plans landing this month.
    let planIncome = 0;
    let planSpend = 0;
    for (const p of plansForMonth(plans, ym)) {
      const amt = Math.abs(Number(p.amount) || 0);
      if (p.direction === "income") planIncome += amt;
      else planSpend += amt;
    }

    // Scenario operating deltas: recurring (persist from their month) + one-offs.
    let recIncome = 0;
    let recExpense = 0;
    let oneIncome = 0;
    let oneExpense = 0;
    for (const e of events) {
      if (e.kind === "recurring" && e.fromMonth <= ym) {
        if (e.direction === "income") recIncome += e.amount;
        else recExpense += e.amount;
      } else if (e.kind === "one_off" && e.month === ym) {
        if (e.direction === "income") oneIncome += e.amount;
        else oneExpense += e.amount;
      }
    }

    const income = monthlyIncome * fI + planIncome + recIncome + oneIncome;
    const everyday = (fixedNonDebtMonthly + variableMonthly) * fE * spendMult + recExpense;
    const expenses = everyday + planSpend + oneExpense;

    // Capital events this month: loans (cash in + new debt), asset purchases
    // (cash out + asset in), overpayments (cash out + debt down).
    let capitalIn = 0;
    let capitalOut = 0;
    for (const e of events) {
      if (e.kind === "loan" && e.month === ym) {
        const rate = monthlyRateFromTaeg(e.aprPct);
        const inst =
          installmentFor(e.principal, rate, e.termMonths) ||
          e.principal / Math.max(1, e.termMonths);
        debts.set(e.id, { balance: Math.max(0, e.principal), monthlyRate: rate, installment: inst });
        capitalIn += e.principal;
      } else if (e.kind === "asset_purchase" && e.month === ym) {
        capitalOut += e.price;
        assetsAdded += e.assetValue ?? e.price;
      } else if (e.kind === "overpay" && e.month === ym) {
        const d = debts.get(e.targetDebtId);
        if (d) {
          const applied = Math.min(e.amount, d.balance);
          d.balance -= applied;
          capitalOut += applied;
        }
      }
    }

    // Amortize every active debt one step.
    let debtPaid = 0;
    for (const d of debts.values()) {
      if (d.balance <= 0) continue;
      const interest = d.balance * d.monthlyRate;
      const pay = Math.min(d.installment, d.balance + interest);
      d.balance = Math.max(0, d.balance + interest - pay);
      debtPaid += pay;
    }

    const surplus = income - expenses - debtPaid;
    savings += surplus + capitalIn - capitalOut;

    const debtRemaining = [...debts.values()].reduce((s, d) => s + d.balance, 0);
    const assets = assetsTotal * fA + assetsAdded;
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
  balance: number;
  monthlyContribution: number;
  goalTarget?: number | null;
  monthsToGoal?: number | null;
};

export type ProjectedProject = {
  id: string;
  name: string;
  startBalance: number;
  projectedBalance: number;
  reachedGoal: boolean;
};

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
