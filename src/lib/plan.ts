/**
 * Forward planning — pure, deterministic, no network.
 *
 * A "plan" is a future money event the household already knows about: a one-off
 * cost (tyres in August), a repeating cost (car service every October, extra at
 * Christmas), or a change in income (an extra 800 from September onward). Plans
 * never touch the standing monthly baseline (that stays recurring-only). Instead
 * they drive a forward forecast of the next few cycles, and each spend plan can
 * be pre-funded by a goal_by_date project so it doesn't land as a lump.
 */

export type PlanDirection = "spend" | "income";
export type PlanRecurrence = "one_off" | "annual" | "ongoing";

export type Plan = {
  id: string;
  label: string;
  /** Always positive; `direction` decides the sign. */
  amount: number | string;
  direction: PlanDirection;
  /** The month it lands in, as an ISO date (first of month by convention). */
  month: string;
  recurrence: PlanRecurrence;
  category: string | null;
  /** When set, a project is saving for this plan, so it won't land as a lump. */
  bucket_id: string | null;
  done?: boolean;
};

/** "yyyy-mm" key for a date. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Does a plan apply to the given "yyyy-mm" month? */
export function planAppliesToMonth(plan: Plan, ym: string): boolean {
  const pym = String(plan.month).slice(0, 7); // yyyy-mm the plan starts in
  if (plan.recurrence === "one_off") return pym === ym;
  if (plan.recurrence === "ongoing") return ym >= pym; // from its month onward
  // annual: same calendar month each year, from its start year onward.
  if (ym < pym) return false;
  return ym.slice(5, 7) === pym.slice(5, 7);
}

/** Plans (of either direction) that land in a given month, excluding done ones. */
export function plansForMonth(plans: Plan[], ym: string): Plan[] {
  return plans.filter((p) => !p.done && planAppliesToMonth(p, ym));
}

/**
 * Unfunded planned spend for a month: spend plans that land in it and are NOT
 * being pre-funded by a project. Funded plans are excluded because their cost is
 * being set aside gradually via the project's allocations, so they shouldn't also
 * hit that month's cash as a lump. This is the figure the dashboard subtracts
 * from the current cycle's surplus.
 */
export function unfundedPlannedSpend(plans: Plan[], ym: string): number {
  return round2(
    plansForMonth(plans, ym)
      .filter((p) => p.direction === "spend" && !p.bucket_id)
      .reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0),
  );
}

export type ForecastMonth = {
  ym: string;
  /** Recurring income plus any income plans landing this month. */
  income: number;
  /** Standing recurring baseline (constant across the horizon). */
  baseline: number;
  /** All planned spend landing this month (funded + unfunded), for display. */
  plannedSpend: number;
  /** Planned spend not pre-funded by a project — what actually hits this month. */
  plannedSpendUnfunded: number;
  /** income - baseline - plannedSpendUnfunded. */
  leftover: number;
  shortfall: boolean;
  items: Plan[];
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Build a month-by-month forecast for the next `months` cycles (default 6),
 * starting at `startMonth` (default now). Baseline and recurring income are held
 * constant; plans are overlaid per month.
 */
export function buildForecast(params: {
  plans: Plan[];
  baseline: number;
  monthlyIncome: number;
  startMonth?: Date;
  months?: number;
}): ForecastMonth[] {
  const { plans, baseline, monthlyIncome } = params;
  const months = params.months ?? 6;
  const start = params.startMonth ?? new Date();
  const out: ForecastMonth[] = [];

  for (let i = 0; i < months; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const ym = monthKey(d);
    const items = plansForMonth(plans, ym);

    const incomePlans = items
      .filter((p) => p.direction === "income")
      .reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0);
    const spendAll = items
      .filter((p) => p.direction === "spend")
      .reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0);
    const spendUnfunded = items
      .filter((p) => p.direction === "spend" && !p.bucket_id)
      .reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0);

    const income = round2(monthlyIncome + incomePlans);
    const leftover = round2(income - baseline - spendUnfunded);
    out.push({
      ym,
      income,
      baseline: round2(baseline),
      plannedSpend: round2(spendAll),
      plannedSpendUnfunded: round2(spendUnfunded),
      leftover,
      shortfall: leftover < 0,
      items,
    });
  }
  return out;
}
