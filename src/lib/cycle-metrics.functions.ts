import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bucketBalancesFor, type AccountMovement } from "@/lib/movements";
import { debtLiveSchedule, type Debt } from "@/lib/debt-schedule";
import { defaultIntentForCategory } from "@/lib/intent";
import { getCountryBenchmark, percentileFromDeciles } from "@/lib/benchmarks";
import { plansInWindow, type Plan } from "@/lib/plan";
import { resolveClosedCycles } from "@/lib/cycle-bounds";
import { computeCycleMetrics, type CycleMetricsRow } from "@/lib/cycle-metrics";
import { LIQUID_ASSET_KINDS } from "@/lib/finance-helpers";

const pad = (n: number) => String(n).padStart(2, "0");
/** Local YYYY-MM-DD for a Date (the cycle key), avoiding UTC day-shift. */
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type SnapshotSource = "close" | "cron" | "backfill";

/**
 * Gather one closed cycle's metrics and upsert the row. Pure DB + math, no
 * server-fn wrapper, so it can be reused by the rollover action and the daily
 * cron (which hold an admin client) as well as by the server fn below. Idempotent
 * on (household_id, cycle_start).
 *
 * `start`/`end` are the precise cycle bounds used to window expenses/movements;
 * the stored cycle_start/cycle_end are their local dates. Mirrors the Snapshot
 * page's gathering with cycleProgress fixed at 1 (the cycle is over).
 */
export async function snapshotCycleCore(
  sb: SupabaseClient,
  args: { householdId: string; start: Date; end: Date; source?: SnapshotSource },
): Promise<{ ok: boolean; cycle_start: string; score: number | null }> {
  const { householdId, start, end } = args;
  const source = args.source ?? "close";
  const cycleStart = localDateStr(start);
  const cycleEnd = localDateStr(end);
  // Allocations are keyed by the month the cycle STARTS in.
  const period = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`;

  const { data: hh } = await sb
    .from("households")
    .select("kind, baseline_budget, adults, children, country, employees")
    .eq("id", householdId)
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
    sb.from("incomes").select("monthly_amount").eq("household_id", householdId),
    sb.from("fixed_expenses").select("monthly_amount").eq("household_id", householdId),
    sb.from("debts").select("monthly_amount").eq("household_id", householdId),
    sb.from("buckets").select("id, kind, target_value, initial_balance").eq("household_id", householdId),
    sb.from("bucket_allocations").select("bucket_id, amount, period").eq("household_id", householdId),
    sb.from("account_movements").select("*").eq("household_id", householdId),
    sb
      .from("expenses")
      .select("amount, kind, is_salary, merchant, intent, category")
      .eq("household_id", householdId)
      .gte("occurred_at", start.toISOString())
      .lt("occurred_at", end.toISOString()),
    sb.from("assets").select("current_value, kind, bucket_id").eq("household_id", householdId),
    sb.from("debts").select("*").eq("household_id", householdId),
    sb
      .from("plans")
      .select("id, label, amount, actual_amount, direction, month, recurrence, category, bucket_id, done")
      .eq("household_id", householdId),
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
        cycleStart,
        cycleEnd,
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
        cycleStart,
        cycleEnd,
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
      household_id: householdId,
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
      source,
    },
    { onConflict: "household_id,cycle_start" },
  );
  if (error) throw error;
  return { ok: true, cycle_start: row.cycle_start, score: row.score_overall };
}

type Space = Parameters<typeof resolveClosedCycles>[2];

/**
 * Snapshot the cycle that most recently closed for a space. The rollover action
 * and the daily cron both call this the moment a cycle ends. No-op when there is
 * no finished cycle yet. Idempotent via the upsert underneath.
 */
export async function snapshotJustClosedCycle(
  sb: SupabaseClient,
  householdId: string,
  space: Space,
  source: SnapshotSource,
  now: Date = new Date(),
): Promise<{ ok: boolean; cycle_start?: string }> {
  const closed = await resolveClosedCycles(sb, householdId, space, 1, now);
  const last = closed[closed.length - 1];
  if (!last) return { ok: false };
  return snapshotCycleCore(sb, { householdId, start: last.start, end: last.end, source });
}

/** Explicit single-cycle snapshot (dates as YYYY-MM-DD). Thin wrapper over core. */
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
  .handler(({ context, data }) =>
    snapshotCycleCore(context.supabase, {
      householdId: data.household_id,
      start: new Date(`${data.cycle_start}T00:00:00`),
      end: new Date(`${data.cycle_end}T00:00:00`),
      source: data.source,
    }),
  );

/**
 * Lazy backfill: snapshot any of the last `max` CLOSED cycles that don't already
 * have a row. Called on Analysis load so history appears for existing users and
 * gaps (missed cron, never-opened Analysis) heal themselves. Backfilled rows use
 * today's baseline/estimates, so they are money-accurate but their score is
 * approximate — recorded with source='backfill'.
 */
export const backfillCycleMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ household_id: z.string().uuid(), max: z.number().int().min(1).max(24).default(12) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: space } = await sb
      .from("households")
      .select("kind, cycle, cycle_mode, cycle_anchor_date")
      .eq("id", data.household_id)
      .maybeSingle();
    const closed = await resolveClosedCycles(sb, data.household_id, space, data.max);
    if (!closed.length) return { backfilled: 0 };

    const { data: existing } = await sb
      .from("cycle_metrics")
      .select("cycle_start")
      .eq("household_id", data.household_id);
    const have = new Set((existing ?? []).map((r) => r.cycle_start as string));

    let backfilled = 0;
    for (const c of closed) {
      if (have.has(localDateStr(c.start))) continue;
      try {
        await snapshotCycleCore(sb, {
          householdId: data.household_id,
          start: c.start,
          end: c.end,
          source: "backfill",
        });
        backfilled += 1;
      } catch (e) {
        console.error("backfillCycleMetrics: snapshot failed", localDateStr(c.start), e);
      }
    }
    return { backfilled };
  });
