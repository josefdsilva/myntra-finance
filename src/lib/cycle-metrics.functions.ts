import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bucketBalancesFor, type AccountMovement } from "@/lib/movements";
import { debtLiveSchedule, type Debt } from "@/lib/debt-schedule";
import { defaultIntentForCategory } from "@/lib/intent";
import { getCountryBenchmark, percentileFromDeciles } from "@/lib/benchmarks";
import { plansInWindow, type Plan } from "@/lib/plan";
import { computeCycleMetrics, type CycleMetricsRow } from "@/lib/cycle-metrics";

const LIQUID_ASSET_KINDS = new Set(["stocks", "bonds", "fund"]);

/**
 * Snapshot ONE closed cycle's metrics and upsert the row. Idempotent on
 * (household_id, cycle_start), so re-running (a retried rollover, the cron, a
 * manual refresh) never duplicates or double-counts.
 *
 * The caller passes the closed cycle window — the rollover action and the daily
 * cron both already resolve it — which keeps this fn free of cycle-sequence
 * logic. The gathering deliberately mirrors the Snapshot page so the stored
 * score matches what the user saw, only with cycleProgress fixed at 1 (the cycle
 * is over) and the window scoped to [cycle_start, cycle_end).
 */
export const snapshotCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        household_id: z.string().uuid(),
        cycle_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        cycle_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        source: z.enum(["close", "cron", "backfill"]).default("close"),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const hhId = data.household_id;
    const start = new Date(`${data.cycle_start}T00:00:00.000Z`);
    const end = new Date(`${data.cycle_end}T00:00:00.000Z`);
    // Allocations are keyed by the month the cycle STARTS in (a cycle can straddle
    // two months). Build the period key straight from the date string — no TZ math.
    const period = `${data.cycle_start.slice(0, 7)}-01`;

    const { data: hh } = await sb
      .from("households")
      .select("kind, baseline_budget, adults, children, country, employees")
      .eq("id", hhId)
      .maybeSingle();
    const baseline = Number(hh?.baseline_budget ?? 0);
    const isBusiness = hh?.kind === "business";

    const [
      { data: incomes },
      { data: fixed },
      { data: debts },
      { data: buckets },
      { data: allocs },
      { data: moves },
      { data: expenses },
      { data: assetsRows },
      { data: debtRows },
      { data: plansRows },
    ] = await Promise.all([
      sb.from("incomes").select("monthly_amount").eq("household_id", hhId),
      sb.from("fixed_expenses").select("monthly_amount").eq("household_id", hhId),
      sb.from("debts").select("monthly_amount").eq("household_id", hhId),
      sb.from("buckets").select("id, kind, target_value, initial_balance").eq("household_id", hhId),
      sb.from("bucket_allocations").select("bucket_id, amount, period").eq("household_id", hhId),
      sb.from("account_movements").select("*").eq("household_id", hhId),
      sb
        .from("expenses")
        .select("amount, kind, is_salary, merchant, intent, category")
        .eq("household_id", hhId)
        .gte("occurred_at", start.toISOString())
        .lt("occurred_at", end.toISOString()),
      sb.from("assets").select("current_value, kind, bucket_id").eq("household_id", hhId),
      sb.from("debts").select("*").eq("household_id", hhId),
      sb
        .from("plans")
        .select("id, label, amount, actual_amount, direction, month, recurrence, category, bucket_id, done")
        .eq("household_id", hhId),
    ]);

    const incomeRows = incomes ?? [];
    const income = incomeRows.reduce((s, r) => s + Number(r.monthly_amount), 0);
    const debtMonthly = (debts ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
    const fixedTotal = (fixed ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0) + debtMonthly;

    const bucketList = buckets ?? [];
    const balances = bucketBalancesFor(bucketList, allocs ?? [], (moves ?? []) as AccountMovement[]);
    const linkedBucketIds = new Set(
      (assetsRows ?? []).map((a) => a.bucket_id).filter((x): x is string => !!x),
    );
    const bucketsTotal = Object.entries(balances).reduce(
      (s, [id, v]) => (linkedBucketIds.has(id) ? s : s + v),
      0,
    );
    const hasInvestment = bucketList.some((b) => b.kind === "investment");
    const variablePool = Math.max(0, baseline - fixedTotal);

    const exp = expenses ?? [];
    const grossSpent = exp.filter((r) => r.kind !== "income").reduce((s, r) => s + Number(r.amount), 0);
    const received = exp
      .filter((r) => r.kind === "income" && !r.is_salary)
      .reduce((s, r) => s + Number(r.amount), 0);
    const incomeReceived = exp
      .filter((r) => r.kind === "income")
      .reduce((s, r) => s + Number(r.amount), 0);
    const variableSpent = Math.max(0, grossSpent - received);
    const incomeActual = incomeReceived > 0 ? incomeReceived : income;

    // Money set aside to projects THIS CYCLE (allocations for the cycle's month +
    // net deposits within the window; a plan paid out of a project isn't saving).
    const confirmedThisCycle = (allocs ?? [])
      .filter((a) => a.period === period)
      .reduce((s, a) => s + Number(a.amount), 0);
    const netIntoProjects = ((moves ?? []) as AccountMovement[]).reduce((s, m) => {
      const created = new Date(m.created_at);
      if (created < start || created >= end) return s;
      if (m.reason === "plan_payment") return s;
      let d = 0;
      if (m.to_type === "bucket") d += Number(m.amount);
      if (m.from_type === "bucket") d -= Number(m.amount);
      return s + d;
    }, 0);
    const projectFunded = Math.max(0, confirmedThisCycle + netIntoProjects);

    // Assets & net worth.
    const assetsTotal = (assetsRows ?? []).reduce((s, a) => s + Number(a.current_value), 0);
    const liquidAssets = (assetsRows ?? [])
      .filter((a) => LIQUID_ASSET_KINDS.has(a.kind))
      .reduce((s, a) => s + Number(a.current_value), 0);
    const debtRemaining = ((debtRows ?? []) as Debt[]).reduce(
      (s, d) => s + debtLiveSchedule(d).remaining,
      0,
    );
    const netWorth = assetsTotal + bucketsTotal - debtRemaining;
    const hasNetWorthData = assetsTotal > 0 || bucketsTotal > 0 || debtRemaining > 0;

    // Consumption quality: nice-to-have + treat share of this cycle's spend.
    let superSum = 0;
    for (const r of exp) {
      if (r.kind === "income") continue;
      const level =
        (r.intent as string | null) || defaultIntentForCategory(String(r.category ?? "other"));
      if (level === "nice_to_have" || level === "treat") superSum += Number(r.amount);
    }
    const superfluousShare = grossSpent > 0 ? Math.min(1, superSum / grossSpent) : null;
    const consumptionRatio = income > 0 ? (fixedTotal + variableSpent) / income : null;

    const investedFromBuckets = bucketList
      .filter((b) => b.kind === "investment" && !linkedBucketIds.has(b.id))
      .reduce((s, b) => s + Math.max(0, balances[b.id] ?? 0), 0);
    const investedAmount = investedFromBuckets + Math.max(0, liquidAssets);

    const targeted = bucketList.filter((b) => !linkedBucketIds.has(b.id) && Number(b.target_value) > 0);
    const fundedFraction =
      targeted.length > 0
        ? targeted.reduce(
            (s, b) => s + Math.min(1, Math.max(0, balances[b.id] ?? 0) / Number(b.target_value)),
            0,
          ) / targeted.length
        : null;

    // Income percentile vs country deciles (leak-free, relative position only).
    const adults = Math.max(1, Number(hh?.adults ?? 1));
    const children = Math.max(0, Number(hh?.children ?? 0));
    const equivFactor = 1 + 0.5 * (adults - 1) + 0.3 * children;
    const equivAnnual = (income * 12) / (equivFactor || 1);
    const bench = getCountryBenchmark(hh?.country);
    const incomePercentile = bench?.incomeDecilesAnnualEquivalised
      ? percentileFromDeciles(
          equivAnnual,
          bench.incomeDecilesAnnualEquivalised as Parameters<typeof percentileFromDeciles>[1],
        )
      : null;

    // Estimates in force at close, for calibration.
    const plans = (plansRows ?? []) as unknown as Plan[];
    const winPlans = plansInWindow(plans, start, end);
    const incomePlans = winPlans
      .filter((p) => p.direction === "income")
      .reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0);
    const spendUnfunded = winPlans
      .filter((p) => p.direction === "spend" && !p.bucket_id)
      .reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0);
    const incomeExpected = income + incomePlans;
    const plannedSpend = baseline + spendUnfunded;

    const availableEnd = incomeActual - fixedTotal - projectFunded - variableSpent;
    const scoreable = income > 0 || baseline > 0 || bucketsTotal > 0;

    // Business indicators (only used for business spaces).
    const incomeSources = incomeRows.map((r) => Number(r.monthly_amount)).filter((n) => n > 0);
    const distinctClients = new Set(
      exp
        .filter((r) => r.kind === "income")
        .map((r) => (r.merchant ?? "").trim().toLowerCase())
        .filter((m) => m.length > 0),
    ).size;
    const monthlyOutgoings = fixedTotal + variablePool;
    const operatingCashFlow = income - monthlyOutgoings;
    const reserve = bucketsTotal + Math.max(0, liquidAssets);
    const runwayMonths = monthlyOutgoings > 0 ? reserve / monthlyOutgoings : 0;

    const row: CycleMetricsRow = isBusiness
      ? computeCycleMetrics({
          kind: "business",
          score: {
            revenueMonthly: income,
            operatingCashFlow,
            reserve,
            monthlyOutgoings,
            debtMonthly,
            netWorth,
            hasNetWorthData,
            incomeSources,
            distinctClients,
            employees: Number(hh?.employees ?? 0),
            hasProjects: bucketList.length > 0,
            activityCount: exp.length,
          },
          cycleStart: data.cycle_start,
          cycleEnd: data.cycle_end,
          incomeActual,
          spendActual: variableSpent,
          fixedTotal,
          debtTotal: debtMonthly,
          projectFunded,
          everydayPool: variablePool,
          everydaySpent: variableSpent,
          availableEnd,
          superfluousShare,
          consumptionRatio,
          incomeExpected,
          plannedSpend,
          baselineAtClose: baseline,
          scoreable,
          extra: { runwayMonths: Math.round(runwayMonths * 10) / 10, distinctClients },
        })
      : computeCycleMetrics({
          kind: "personal",
          score: {
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
            variableSpent,
            cycleProgress: 1,
          },
          cycleStart: data.cycle_start,
          cycleEnd: data.cycle_end,
          incomeActual,
          spendActual: variableSpent,
          fixedTotal,
          debtTotal: debtMonthly,
          projectFunded,
          everydayPool: variablePool,
          everydaySpent: variableSpent,
          availableEnd,
          superfluousShare,
          consumptionRatio,
          incomeExpected,
          plannedSpend,
          baselineAtClose: baseline,
          scoreable,
        });

    const { error } = await sb.from("cycle_metrics").upsert(
      {
        household_id: hhId,
        kind: row.kind,
        cycle_start: row.cycle_start,
        cycle_end: row.cycle_end,
        income_actual: row.income_actual,
        spend_actual: row.spend_actual,
        fixed_total: row.fixed_total,
        debt_total: row.debt_total,
        project_funded: row.project_funded,
        surplus_actual: row.surplus_actual,
        everyday_pool: row.everyday_pool,
        everyday_spent: row.everyday_spent,
        available_end: row.available_end,
        score_overall: row.score_overall,
        superfluous_share: row.superfluous_share,
        consumption_ratio: row.consumption_ratio,
        income_expected: row.income_expected,
        planned_spend: row.planned_spend,
        baseline_at_close: row.baseline_at_close,
        metrics: row.metrics as never,
        source: data.source,
      },
      { onConflict: "household_id,cycle_start" },
    );
    if (error) throw error;
    return { ok: true, cycle_start: row.cycle_start, score: row.score_overall };
  });
