// Shared metric registry — the single place that defines the KPIs a "KPI Target"
// can track. It READS values from the same raw data the rest of the app uses
// (bucket balances via movements.ts, incomes, debts, fixed expenses, baseline,
// cycle_metrics) and never forks or overrides the existing financial math. The
// formulas here mirror the journey page's `metrics` useMemo exactly so numbers
// agree across surfaces.

import { supabase } from "@/integrations/supabase/client";
import { bucketBalancesFor, fetchMovements, type AccountMovement } from "@/lib/movements";
import type { MessageKey } from "@/lib/i18n";

export type MetricKey =
  | "emergency_months"
  | "dti_pct"
  | "invested_months"
  | "invested_years"
  | "total_income"
  | "income_concentration"
  | "spending_vs_plan";

/** null = not enough data to compute this metric yet (UI shows "—"). */
export type MetricValue = number | null;

export type MetricFormat = "months" | "years" | "pct" | "currency";

export type MetricMeta = {
  key: MetricKey;
  labelKey: MessageKey;
  descKey: MessageKey;
  format: MetricFormat;
  /** Which direction is "good" — drives the default operator and progress. */
  betterWhen: "higher" | "lower";
  defaultOp: ">=" | "<=";
};

/** The full registry, in a sensible display order. */
export const METRICS: MetricMeta[] = [
  { key: "emergency_months", labelKey: "kpi.metric.emergency_months", descKey: "kpi.metric.emergency_months.desc", format: "months", betterWhen: "higher", defaultOp: ">=" },
  { key: "dti_pct", labelKey: "kpi.metric.dti_pct", descKey: "kpi.metric.dti_pct.desc", format: "pct", betterWhen: "lower", defaultOp: "<=" },
  { key: "invested_months", labelKey: "kpi.metric.invested_months", descKey: "kpi.metric.invested_months.desc", format: "months", betterWhen: "higher", defaultOp: ">=" },
  { key: "invested_years", labelKey: "kpi.metric.invested_years", descKey: "kpi.metric.invested_years.desc", format: "years", betterWhen: "higher", defaultOp: ">=" },
  { key: "total_income", labelKey: "kpi.metric.total_income", descKey: "kpi.metric.total_income.desc", format: "currency", betterWhen: "higher", defaultOp: ">=" },
  { key: "income_concentration", labelKey: "kpi.metric.income_concentration", descKey: "kpi.metric.income_concentration.desc", format: "pct", betterWhen: "lower", defaultOp: "<=" },
  { key: "spending_vs_plan", labelKey: "kpi.metric.spending_vs_plan", descKey: "kpi.metric.spending_vs_plan.desc", format: "pct", betterWhen: "lower", defaultOp: "<=" },
];

const BY_KEY: Record<string, MetricMeta> = Object.fromEntries(METRICS.map((m) => [m.key, m]));

export function metricMeta(key: string): MetricMeta | undefined {
  return BY_KEY[key];
}

// ---- Inputs + computation ----

export type MetricInputs = {
  baseline: number;
  buckets: Array<{ id: string; kind: string | null }>;
  balances: Record<string, number>;
  incomes: number[]; // monthly_amount per source
  debtMonthly: number;
  fixedMonthly: number;
  /** Latest cycle snapshot for spending vs plan (null if none closed yet). */
  spendActual: number | null;
  plannedSpend: number | null;
};

/** Fetch everything the registry needs, client-side, mirroring the journey page. */
export async function fetchMetricInputs(householdId: string): Promise<MetricInputs> {
  const [hh, bucketsRes, allocsRes, movements, incomesRes, debtsRes, fixedRes, cmRes] = await Promise.all([
    supabase.from("households").select("baseline_budget").eq("id", householdId).maybeSingle(),
    supabase.from("buckets").select("id, kind, initial_balance").eq("household_id", householdId),
    supabase.from("bucket_allocations").select("bucket_id, amount").eq("household_id", householdId),
    fetchMovements(householdId),
    supabase.from("incomes").select("monthly_amount").eq("household_id", householdId),
    supabase.from("debts").select("monthly_amount").eq("household_id", householdId),
    supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", householdId),
    supabase
      .from("cycle_metrics")
      .select("spend_actual, planned_spend")
      .eq("household_id", householdId)
      .order("cycle_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const buckets = (bucketsRes.data ?? []) as Array<{ id: string; kind: string | null; initial_balance: number | string }>;
  const balances = bucketBalancesFor(
    buckets.map((b) => ({ id: b.id, initial_balance: b.initial_balance })),
    (allocsRes.data ?? []) as Array<{ bucket_id: string; amount: number | string }>,
    movements as AccountMovement[],
  );
  const incomes = ((incomesRes.data ?? []) as Array<{ monthly_amount: number | string }>).map((r) => Number(r.monthly_amount) || 0);
  const debtMonthly = ((debtsRes.data ?? []) as Array<{ monthly_amount: number | string }>).reduce((s, r) => s + (Number(r.monthly_amount) || 0), 0);
  const fixedMonthly = ((fixedRes.data ?? []) as Array<{ monthly_amount: number | string }>).reduce((s, r) => s + (Number(r.monthly_amount) || 0), 0);

  return {
    baseline: Number(hh.data?.baseline_budget ?? 0),
    buckets: buckets.map((b) => ({ id: b.id, kind: b.kind })),
    balances,
    incomes,
    debtMonthly,
    fixedMonthly,
    spendActual: cmRes.data ? Number(cmRes.data.spend_actual) : null,
    plannedSpend: cmRes.data?.planned_spend != null ? Number(cmRes.data.planned_spend) : null,
  };
}

/** Compute every metric's current value. null where data is insufficient. */
export function computeMetrics(inp: MetricInputs): Record<MetricKey, MetricValue> {
  const essentials = Math.max(1, inp.baseline || inp.fixedMonthly + inp.debtMonthly);

  let emergencyBal = 0;
  let savingsBal = 0;
  let investBal = 0;
  for (const b of inp.buckets) {
    const bal = inp.balances[b.id] ?? 0;
    if (b.kind === "investment") investBal += bal;
    else if (b.kind === "emergency") emergencyBal += bal;
    else savingsBal += bal;
  }
  const hasEmergency = inp.buckets.some((b) => b.kind === "emergency");
  const liquidReserve = hasEmergency ? emergencyBal : emergencyBal + savingsBal;

  const totalIncome = inp.incomes.reduce((s, v) => s + v, 0);
  const largestIncome = inp.incomes.reduce((mx, v) => Math.max(mx, v), 0);

  const spendingVsPlan =
    inp.spendActual != null && inp.plannedSpend != null && inp.plannedSpend > 0
      ? (inp.spendActual / inp.plannedSpend) * 100
      : null;

  return {
    emergency_months: liquidReserve / essentials,
    dti_pct: totalIncome > 0 ? (inp.debtMonthly / totalIncome) * 100 : 0,
    invested_months: investBal / essentials,
    invested_years: investBal / (12 * essentials),
    total_income: totalIncome,
    income_concentration: totalIncome > 0 ? (largestIncome / totalIncome) * 100 : null,
    spending_vs_plan: spendingVsPlan,
  };
}

// ---- Evaluation + display helpers ----

/** Has a target been reached? */
export function isTargetMet(op: string, current: MetricValue, target: number): boolean {
  if (current == null) return false;
  return op === "<=" ? current <= target : current >= target;
}

/** Progress toward a target, 0..1. For "<=" goals, being at/below target is 100%. */
export function targetProgress(op: string, current: MetricValue, target: number): number {
  if (current == null) return 0;
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  if (op === "<=") {
    if (current <= target) return 1;
    if (current <= 0) return 1;
    return clamp01(target / current);
  }
  if (target <= 0) return current >= target ? 1 : 0;
  return clamp01(current / target);
}

/**
 * Format a metric value for display. Currency is delegated to a caller-provided
 * money formatter so the registry stays free of locale/currency concerns.
 */
export function formatMetricValue(key: MetricKey, value: MetricValue, fmtMoney?: (n: number) => string): string {
  if (value == null || Number.isNaN(value)) return "—";
  const meta = BY_KEY[key];
  const round1 = (n: number) => Math.round(n * 10) / 10;
  switch (meta?.format) {
    case "currency":
      return fmtMoney ? fmtMoney(value) : String(Math.round(value));
    case "pct":
      return `${round1(value)}%`;
    case "years":
      return `${round1(value)} yr`;
    case "months":
    default:
      return `${round1(value)} mo`;
  }
}
