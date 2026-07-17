/**
 * Multi-parameter forward projection for the Plan charts — pure, deterministic.
 *
 * Produces one row per month over the horizon with: income, surplus, the running
 * balance of every savings project (including sinking funds created for plans),
 * the remaining balance of every debt, the accumulated uninvested surplus, and
 * the cumulative interest cleared off the debts. The chart flattens this into
 * one line per series.
 *
 * Assumptions (a forecast, not a promise): projects receive their monthly target
 * each month; debts follow their amortization schedule; income folds in income
 * plans; unfunded planned spend is drawn from that month's surplus.
 */
import { differenceInCalendarMonths } from "date-fns";
import { buildForecast, type Plan } from "./plan";
import { debtLiveSchedule, type Debt } from "./debt-schedule";

export type ProjectInput = {
  id: string;
  name: string;
  kind: "savings" | "emergency" | "investment";
  target_type: "pct_surplus" | "fixed_monthly" | "fixed_yearly" | "goal_by_date";
  target_value: number;
  target_deadline: string | null;
  /** Current balance. */
  balance: number;
};

export type SeriesPoint = {
  month: string; // yyyy-mm
  label: string; // e.g. "Aug 26"
  income: number;
  surplus: number;
  /** Cumulative surplus not allocated to any project or plan. */
  uninvestedSurplus: number;
  /** Cumulative interest no longer owed across all debts vs. the start. */
  interestSaved: number;
  /** Projected balance per project id. */
  projects: Record<string, number>;
  /** Projected remaining balance per debt id. */
  debts: Record<string, number>;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const shortLabel = (d: Date) =>
  d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });

/** A project's contribution in a given month, before capping to its target. */
function monthlyContribution(p: ProjectInput, surplus: number, balance: number, atMonth: Date): number {
  const v = Number(p.target_value) || 0;
  if (p.target_type === "pct_surplus") return (Math.max(0, surplus) * v) / 100;
  if (p.target_type === "fixed_monthly") return v;
  if (p.target_type === "fixed_yearly") return v / 12;
  // goal_by_date: spread the remaining amount over the months left.
  const remaining = Math.max(0, v - balance);
  if (remaining <= 0) return 0;
  const monthsLeft = p.target_deadline
    ? Math.max(1, differenceInCalendarMonths(new Date(p.target_deadline), atMonth))
    : 1;
  return remaining / monthsLeft;
}

const targetCap = (p: ProjectInput): number =>
  p.target_type === "goal_by_date" ? Number(p.target_value) || Infinity : Infinity;

export function buildForecastSeries(params: {
  plans: Plan[];
  projects: ProjectInput[];
  debts: Debt[];
  baseline: number;
  monthlyIncome: number;
  months: number; // 3 | 6 | 12
  startMonth?: Date;
}): SeriesPoint[] {
  const { plans, projects, debts, baseline, monthlyIncome, months } = params;
  const start = params.startMonth ?? new Date();
  const forecast = buildForecast({ plans, baseline, monthlyIncome, startMonth: start, months });

  const projBal: Record<string, number> = {};
  for (const p of projects) projBal[p.id] = Number(p.balance) || 0;

  const interest0 = debts.reduce(
    (s, d) => s + (debtLiveSchedule(d, start).totalInterestRemaining || 0),
    0,
  );

  let cumUninvested = 0;
  const out: SeriesPoint[] = [];

  for (let i = 0; i < months; i += 1) {
    const monthStart = new Date(start.getFullYear(), start.getMonth() + i, 1);
    // Evaluate debts at end of the month so a full month's payment is reflected.
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + i + 1, 0);
    const fc = forecast[i];
    const surplus = Math.max(0, fc.income - baseline);

    let projContrib = 0;
    for (const p of projects) {
      const contrib = monthlyContribution(p, surplus, projBal[p.id], monthStart);
      projBal[p.id] = round2(Math.min(targetCap(p), projBal[p.id] + contrib));
      projContrib += contrib;
    }

    const un = Math.max(0, surplus - projContrib - fc.plannedSpendUnfunded);
    cumUninvested = round2(cumUninvested + un);

    const debtsMap: Record<string, number> = {};
    let interestRemaining = 0;
    for (const d of debts) {
      const s = debtLiveSchedule(d, monthEnd);
      debtsMap[d.id] = s.remaining;
      interestRemaining += s.totalInterestRemaining || 0;
    }

    out.push({
      month: fc.ym,
      label: shortLabel(monthStart),
      income: fc.income,
      surplus,
      uninvestedSurplus: cumUninvested,
      interestSaved: round2(Math.max(0, interest0 - interestRemaining)),
      projects: { ...projBal },
      debts: debtsMap,
    });
  }
  return out;
}
