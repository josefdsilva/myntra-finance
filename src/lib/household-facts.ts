import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCycleBounds } from "@/lib/cycle-bounds";
import { sumMonthly } from "@/lib/finance-helpers";

// Canonical cycle math for a space. The derived numbers (variable pool, net
// spent, surplus, overspend, and the two ratios) were re-implemented in ~8
// places; this is the single source of truth. `deriveCycleFacts` is pure and
// unit-tested; `gatherCycleFacts` fetches the raw rows and calls it.

export type CycleFactsInput = {
  baseline: number;
  /** Monthly fixed commitments = recurring fixed expenses + debt payments. */
  fixedTotal: number;
  monthlyIncome: number;
  /** Cycle spend minus non-salary money received, floored at 0. */
  netSpent: number;
};

export type CycleFacts = CycleFactsInput & {
  /** What is available for everyday spending this cycle. */
  variablePool: number;
  /** Share of the everyday pool used (1 = spent, >1 = overspent). */
  baselineRatio: number;
  /** Monthly income above the baseline. */
  surplus: number;
  /** Everyday spend above the pool. */
  overspend: number;
  /** Share of the surplus eroded by overspend. */
  emergencyRatio: number;
};

export function deriveCycleFacts(i: CycleFactsInput): CycleFacts {
  const variablePool = Math.max(0, i.baseline - i.fixedTotal);
  const baselineRatio = variablePool > 0 ? i.netSpent / variablePool : i.netSpent > 0 ? 1 : 0;
  const surplus = Math.max(0, i.monthlyIncome - i.baseline);
  const overspend = Math.max(0, i.netSpent - variablePool);
  const emergencyRatio = surplus > 0 ? overspend / surplus : overspend > 0 ? 1 : 0;
  return { ...i, variablePool, baselineRatio, surplus, overspend, emergencyRatio };
}

export type CycleFactsSpace = {
  id: string;
  baseline_budget: number | string | null;
  kind: string | null;
  cycle: string | null;
  cycle_mode: string | null;
  cycle_anchor_date: string | null;
};

export type GatheredCycleFacts = CycleFacts & {
  cycleStart: Date;
  cycleEnd: Date;
  cycleKey: string; // cycle start as YYYY-MM-DD
};

/** Fetch the raw rows for a space's current cycle and derive the facts. */
export async function gatherCycleFacts(
  sb: SupabaseClient,
  space: CycleFactsSpace,
  now?: Date,
): Promise<GatheredCycleFacts> {
  const baseline = Number(space.baseline_budget ?? 0);
  const cycle = await fetchCycleBounds(sb, space.id, space, now);

  const [{ data: fixed }, { data: debts }] = await Promise.all([
    sb.from("fixed_expenses").select("monthly_amount").eq("household_id", space.id),
    sb.from("debts").select("monthly_amount").eq("household_id", space.id),
  ]);
  const fixedTotal = sumMonthly(fixed) + sumMonthly(debts);

  const { data: cycleExp } = await sb
    .from("expenses")
    .select("amount, kind, is_salary")
    .eq("household_id", space.id)
    .gte("occurred_at", cycle.start.toISOString())
    .lt("occurred_at", cycle.end.toISOString());
  const rows = cycleExp ?? [];
  const spent = rows.filter((r) => r.kind !== "income").reduce((s, r) => s + Number(r.amount), 0);
  const received = rows
    .filter((r) => r.kind === "income" && !r.is_salary)
    .reduce((s, r) => s + Number(r.amount), 0);
  const netSpent = Math.max(0, spent - received);

  const { data: incomes } = await sb
    .from("incomes")
    .select("monthly_amount")
    .eq("household_id", space.id);
  const monthlyIncome = sumMonthly(incomes);

  const facts = deriveCycleFacts({ baseline, fixedTotal, monthlyIncome, netSpent });
  return {
    ...facts,
    cycleStart: cycle.start,
    cycleEnd: cycle.end,
    cycleKey: cycle.start.toISOString().slice(0, 10),
  };
}
