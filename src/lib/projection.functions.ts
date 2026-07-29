import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertHouseholdMember } from "@/lib/household-guard.server";
import { rowsOrEmpty } from "@/lib/query-utils";
import { z } from "zod";
import { debtMonthlyRate, type Debt } from "@/lib/debt-schedule";
import { bucketBalancesFor, type AccountMovement } from "@/lib/movements";
import type { Plan } from "@/lib/plan";
import {
  projectForward,
  projectScenarios,
  projectProjects,
  monthsBetween,
  ABSOLUTE_MAX_MONTHS,
  DEFAULT_SCENARIOS,
  type ProjectionInput,
  type ProjectionDebt,
  type ProjectionProject,
  type ScenarioKey,
  type ScenarioAssumptions,
  type ScenarioEvent,
} from "@/lib/projection";

const ym = z.string().regex(/^\d{4}-\d{2}$/);
const eventSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().min(1),
    kind: z.literal("one_off"),
    direction: z.enum(["income", "expense"]),
    month: ym,
    amount: z.number().min(0).max(100_000_000),
    label: z.string().max(80).optional(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("recurring"),
    direction: z.enum(["income", "expense"]),
    fromMonth: ym,
    amount: z.number().min(0).max(10_000_000),
    label: z.string().max(80).optional(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("loan"),
    month: ym,
    principal: z.number().min(0).max(100_000_000),
    aprPct: z.number().min(0).max(100),
    termMonths: z.number().int().min(1).max(600),
    label: z.string().max(80).optional(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("overpay"),
    month: ym,
    amount: z.number().min(0).max(100_000_000),
    targetDebtId: z.string().min(1),
    label: z.string().max(80).optional(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("asset_purchase"),
    month: ym,
    price: z.number().min(0).max(100_000_000),
    assetValue: z.number().min(0).max(100_000_000).optional(),
    label: z.string().max(80).optional(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("retirement"),
    month: ym,
    monthlyPension: z.number().min(0).max(10_000_000),
    label: z.string().max(80).optional(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("salary_change"),
    month: ym,
    newMonthlySalary: z.number().min(0).max(10_000_000),
    label: z.string().max(80).optional(),
  }),
]);

/**
 * Scenario assumption set with the savings return centred on `r` (expected),
 * bracketed by cautious (r-2, floored at 0) and optimistic (r+2).
 * NOTE: retirement/job-change now live as Fast Forward events; the two
 * dedicated server fns below are unused and slated for removal.
 */
function scenarioSetForReturn(r?: number): Record<ScenarioKey, ScenarioAssumptions> {
  const base = r ?? DEFAULT_SCENARIOS.expected.savingsReturnAnnualPct ?? 3;
  return {
    expected: { ...DEFAULT_SCENARIOS.expected, savingsReturnAnnualPct: base },
    cautious: { ...DEFAULT_SCENARIOS.cautious, savingsReturnAnnualPct: Math.max(0, base - 2) },
    optimistic: { ...DEFAULT_SCENARIOS.optimistic, savingsReturnAnnualPct: base + 2 },
  };
}

/** Months from now until the first of `targetYm` (YYYY-MM), clamped to the cap. */
function monthsToTarget(targetYm: string): number {
  const [y, m] = targetYm.split("-").map(Number);
  const target = new Date(y, (m || 1) - 1, 1);
  const now = new Date();
  // Allow long horizons (retirement is decades out); the engine caps at 40y.
  return Math.max(1, Math.min(ABSOLUTE_MAX_MONTHS, monthsBetween(now, target)));
}

/**
 * "Fast forward to a date": assemble the household's current position and roll it
 * forward under three scenarios, plus a per-project funding view. Pure math lives
 * in projection.ts — this only gathers the inputs.
 */
export const fastForward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        // Target month as YYYY-MM.
        targetMonth: z.string().regex(/^\d{4}-\d{2}$/),
        events: z.array(eventSchema).max(50).optional().default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertHouseholdMember(supabase, data.householdId, context.userId);
    const hid = data.householdId;

    const [
      { data: hh },
      { data: incomes },
      { data: fixed },
      { data: variable },
      { data: debtsData },
      { data: plansData },
      { data: buckets },
      { data: allocs },
      { data: moves },
      { data: assetsData },
    ] = await Promise.all([
      supabase.from("households").select("currency, baseline_budget, kind").eq("id", hid).maybeSingle(),
      supabase.from("incomes").select("monthly_amount, type").eq("household_id", hid),
      supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", hid),
      supabase.from("variable_estimates").select("monthly_amount").eq("household_id", hid),
      supabase.from("debts").select("*").eq("household_id", hid),
      supabase
        .from("plans")
        .select("id, label, amount, actual_amount, direction, month, recurrence, category, bucket_id, done")
        .eq("household_id", hid),
      supabase
        .from("buckets")
        .select("id, name, target_type, target_value, target_deadline, initial_balance, kind")
        .eq("household_id", hid),
      supabase.from("bucket_allocations").select("bucket_id, amount").eq("household_id", hid),
      supabase
        .from("account_movements")
        .select("*")
        .eq("household_id", hid)
        .or("to_type.eq.bucket,from_type.eq.bucket"),
      supabase.from("assets").select("current_value, bucket_id").eq("household_id", hid),
    ]);

    const sum = (rows: unknown): number =>
      rowsOrEmpty<{ monthly_amount: number | string }>(rows as never).reduce(
        (s, r) => s + Number(r.monthly_amount || 0),
        0,
      );
    const monthlyIncome = sum(incomes);
    const salaryMonthly = rowsOrEmpty<{ monthly_amount: number | string; type: string | null }>(incomes)
      .filter((r) => (r.type ?? "") === "salary")
      .reduce((s, r) => s + Number(r.monthly_amount || 0), 0);
    const fixedNonDebtMonthly = sum(fixed);
    const variableMonthly = sum(variable);

    const debtRows = rowsOrEmpty<Debt>(debtsData);
    const debtMonthly = debtRows.reduce((s, d) => s + Number(d.monthly_amount || 0), 0);
    const debts: ProjectionDebt[] = debtRows
      .map((d) => ({
        id: d.id,
        label: d.label,
        balance: Number(d.principal_remaining ?? d.starting_principal ?? 0),
        monthlyRate: debtMonthlyRate(d),
        installment: Number(d.monthly_amount || 0),
      }))
      .filter((d) => d.balance > 0 && d.installment > 0);

    // Project balances (initial + confirmations + net movements) — same as the
    // app's true balance. Subtract balances linked to an asset so net worth
    // doesn't double-count them.
    const bucketRows = rowsOrEmpty<{
      id: string;
      name: string;
      target_type: string;
      target_value: number | string;
      target_deadline: string | null;
      initial_balance: number | string;
      kind: string | null;
    }>(buckets);
    const balances = bucketBalancesFor(
      bucketRows.map((b) => ({ id: b.id, initial_balance: b.initial_balance })),
      rowsOrEmpty<{ bucket_id: string; amount: number | string }>(allocs),
      rowsOrEmpty<AccountMovement>(moves),
    );
    const assetRows = rowsOrEmpty<{ current_value: number | string; bucket_id: string | null }>(
      assetsData,
    );
    const assetsTotal = assetRows.reduce((s, a) => s + Number(a.current_value || 0), 0);
    const linkedBucketIds = new Set(
      assetRows.map((a) => a.bucket_id).filter((x): x is string => !!x),
    );
    let totalSavings = 0;
    let linkedBalance = 0;
    for (const b of bucketRows) {
      const bal = balances[b.id] ?? 0;
      totalSavings += bal;
      if (linkedBucketIds.has(b.id)) linkedBalance += bal;
    }
    const startingSavings = totalSavings - linkedBalance;

    // Per-project monthly contribution at its current target (mirrors the app).
    const currentSurplus = Math.max(
      0,
      monthlyIncome - (fixedNonDebtMonthly + variableMonthly + debtMonthly),
    );
    const now = new Date();
    const monthsUntil = (deadline: string | null): number => {
      if (!deadline) return 1;
      const d = new Date(deadline);
      return Math.max(1, monthsBetween(now, d));
    };
    const months = monthsToTarget(data.targetMonth);
    const projectsInput: ProjectionProject[] = bucketRows.map((b) => {
      const balance = balances[b.id] ?? 0;
      const value = Number(b.target_value) || 0;
      let contribution = 0;
      let goalTarget: number | null = null;
      let monthsToGoal: number | null = null;
      if (b.target_type === "pct_surplus") contribution = (currentSurplus * value) / 100;
      else if (b.target_type === "fixed_monthly") contribution = value;
      else if (b.target_type === "fixed_yearly") contribution = value / 12;
      else if (b.target_type === "goal_by_date") {
        goalTarget = value;
        monthsToGoal = monthsUntil(b.target_deadline);
        contribution = Math.max(0, value - balance) / monthsToGoal;
      }
      return { id: b.id, name: b.name, balance, monthlyContribution: contribution, goalTarget, monthsToGoal };
    });

    const events = (data.events ?? []) as ScenarioEvent[];
    const baseInput: ProjectionInput = {
      startMonth: now,
      months,
      maxMonths: ABSOLUTE_MAX_MONTHS,
      monthlyIncome,
      salaryMonthly,
      fixedNonDebtMonthly,
      variableMonthly,
      debts,
      plans: rowsOrEmpty<Plan>(plansData as Plan[] | null),
      startingSavings,
      assetsTotal,
      events,
    };

    const scenarioSeries = projectScenarios(baseInput);
    const keys: ScenarioKey[] = ["expected", "cautious", "optimistic"];
    const scenarios = keys.map((key) => {
      const series = scenarioSeries[key];
      return { key, series, at: series[series.length - 1] };
    });

    // Baseline = the expected path with NO what-if events, so the UI can show
    // the difference the scenario makes. It must use the same expected
    // assumptions (incl. savings return) as the expected scenario, or the two
    // would diverge even when there are no events.
    const baselineSeries = projectForward({
      ...baseInput,
      ...DEFAULT_SCENARIOS.expected,
      events: [],
    });
    const baseline = { series: baselineSeries, at: baselineSeries[baselineSeries.length - 1] };

    const projects = projectProjects(projectsInput, months);

    const startYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    // The month the projection actually reaches (start + clamped horizon), so the
    // UI's headline date always matches the numbers even if a far date was asked.
    const effTarget = new Date(now.getFullYear(), now.getMonth() + months, 1);
    const targetYm = `${effTarget.getFullYear()}-${String(effTarget.getMonth() + 1).padStart(2, "0")}`;

    return {
      currency: hh?.currency ?? "EUR",
      isBusiness: hh?.kind === "business",
      startYm,
      targetYm,
      months,
      current: {
        netWorth: Math.round((assetsTotal + startingSavings - debts.reduce((s, d) => s + d.balance, 0)) * 100) / 100,
        savings: Math.round(startingSavings * 100) / 100,
        assets: Math.round(assetsTotal * 100) / 100,
        debtRemaining: Math.round(debts.reduce((s, d) => s + d.balance, 0) * 100) / 100,
        monthlySurplus: Math.round((monthlyIncome - fixedNonDebtMonthly - variableMonthly - debtMonthly) * 100) / 100,
      },
      scenarios,
      baseline,
      hasEvents: events.length > 0,
      projects,
      // Existing debts an overpayment can target.
      debts: debts.map((d) => ({ id: d.id, label: d.label })),
    };
  });

const retireScenario = z.object({
  id: z.string().min(1).max(40),
  retireMonth: z.string().regex(/^\d{4}-\d{2}$/),
  monthlyPension: z.number().min(0).max(1_000_000),
  label: z.string().max(40).optional(),
});

/**
 * Retirement comparison: roll the household forward over a long horizon under
 * one or more "retire at month X on pension Y" scenarios, so a user can see how
 * their net worth diverges (e.g. retiring at 63 vs 65). Salary stops at the
 * retirement month and the pension takes over; everything else (rent, costs,
 * debts, projects) keeps running. Pure math lives in projection.ts.
 */
export const retirementCompare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        horizonMonths: z.number().int().min(12).max(480).optional().default(360),
        savingsReturnAnnualPct: z.number().min(0).max(15).optional(),
        scenarios: z.array(retireScenario).min(1).max(3),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertHouseholdMember(supabase, data.householdId, context.userId);
    const hid = data.householdId;

    const [
      { data: hh },
      { data: incomes },
      { data: fixed },
      { data: variable },
      { data: debtsData },
      { data: plansData },
      { data: buckets },
      { data: allocs },
      { data: moves },
      { data: assetsData },
    ] = await Promise.all([
      supabase.from("households").select("currency, kind").eq("id", hid).maybeSingle(),
      supabase.from("incomes").select("monthly_amount, type").eq("household_id", hid),
      supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", hid),
      supabase.from("variable_estimates").select("monthly_amount").eq("household_id", hid),
      supabase.from("debts").select("*").eq("household_id", hid),
      supabase
        .from("plans")
        .select("id, label, amount, actual_amount, direction, month, recurrence, category, bucket_id, done")
        .eq("household_id", hid),
      supabase.from("buckets").select("id, initial_balance").eq("household_id", hid),
      supabase.from("bucket_allocations").select("bucket_id, amount").eq("household_id", hid),
      supabase
        .from("account_movements")
        .select("*")
        .eq("household_id", hid)
        .or("to_type.eq.bucket,from_type.eq.bucket"),
      supabase.from("assets").select("current_value, bucket_id").eq("household_id", hid),
    ]);

    const incomeRows = rowsOrEmpty<{ monthly_amount: number | string; type: string | null }>(incomes);
    const monthlyIncome = incomeRows.reduce((s, r) => s + Number(r.monthly_amount || 0), 0);
    const salaryMonthly = incomeRows
      .filter((r) => (r.type ?? "") === "salary")
      .reduce((s, r) => s + Number(r.monthly_amount || 0), 0);

    const sum = (rows: unknown): number =>
      rowsOrEmpty<{ monthly_amount: number | string }>(rows as never).reduce(
        (s, r) => s + Number(r.monthly_amount || 0),
        0,
      );
    const fixedNonDebtMonthly = sum(fixed);
    const variableMonthly = sum(variable);

    const debtRows = rowsOrEmpty<Debt>(debtsData);
    const debtMonthly = debtRows.reduce((s, d) => s + Number(d.monthly_amount || 0), 0);
    const debts: ProjectionDebt[] = debtRows
      .map((d) => ({
        id: d.id,
        label: d.label,
        balance: Number(d.principal_remaining ?? d.starting_principal ?? 0),
        monthlyRate: debtMonthlyRate(d),
        installment: Number(d.monthly_amount || 0),
      }))
      .filter((d) => d.balance > 0 && d.installment > 0);

    const bucketRows = rowsOrEmpty<{ id: string; initial_balance: number | string }>(buckets);
    const balances = bucketBalancesFor(
      bucketRows.map((b) => ({ id: b.id, initial_balance: b.initial_balance })),
      rowsOrEmpty<{ bucket_id: string; amount: number | string }>(allocs),
      rowsOrEmpty<AccountMovement>(moves),
    );
    const assetRows = rowsOrEmpty<{ current_value: number | string; bucket_id: string | null }>(
      assetsData,
    );
    const assetsTotal = assetRows.reduce((s, a) => s + Number(a.current_value || 0), 0);
    const linkedBucketIds = new Set(assetRows.map((a) => a.bucket_id).filter((x): x is string => !!x));
    let startingSavings = 0;
    for (const b of bucketRows) {
      const bal = balances[b.id] ?? 0;
      if (!linkedBucketIds.has(b.id)) startingSavings += bal;
    }

    const horizon = Math.min(480, data.horizonMonths);
    const baseInput: ProjectionInput = {
      startMonth: new Date(),
      months: horizon,
      maxMonths: horizon,
      monthlyIncome,
      salaryMonthly,
      fixedNonDebtMonthly,
      variableMonthly,
      debts,
      plans: rowsOrEmpty<Plan>(plansData as Plan[] | null),
      startingSavings,
      assetsTotal,
    };

    const monthlyCosts = fixedNonDebtMonthly + variableMonthly + debtMonthly;
    const otherIncomeMonthly = Math.max(0, monthlyIncome - salaryMonthly);
    const scenarioSet = scenarioSetForReturn(data.savingsReturnAnnualPct);

    const scenarios = data.scenarios.map((sc) => {
      const events: ScenarioEvent[] = [
        { id: sc.id, kind: "retirement", month: sc.retireMonth, monthlyPension: sc.monthlyPension, label: sc.label },
      ];
      const range = projectScenarios({ ...baseInput, events }, scenarioSet);
      const expected = range.expected;
      const firstRetired = expected.find((m) => m.ym >= sc.retireMonth);
      const runout = expected.find((m) => m.ym >= sc.retireMonth && m.savings < 0)?.ym ?? null;
      const end = expected[expected.length - 1];
      // Downsample to ~yearly points for a light payload, always keeping the last.
      const series = expected
        .filter((_, i) => i % 6 === 0 || i === expected.length - 1)
        .map((m) => ({ ym: m.ym, netWorth: m.netWorth, savings: m.savings }));
      return {
        id: sc.id,
        label: sc.label ?? "",
        retireMonth: sc.retireMonth,
        monthlyPension: sc.monthlyPension,
        series,
        endNetWorth: {
          expected: Math.round(end?.netWorth ?? 0),
          cautious: Math.round(range.cautious[range.cautious.length - 1]?.netWorth ?? 0),
          optimistic: Math.round(range.optimistic[range.optimistic.length - 1]?.netWorth ?? 0),
        },
        postRetireMonthlyIncome: Math.round(firstRetired?.income ?? 0),
        postRetireMonthlySurplus: Math.round(firstRetired?.surplus ?? 0),
        savingsRunoutYm: runout,
      };
    });

    const now = new Date();
    const startYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    return {
      currency: hh?.currency ?? "EUR",
      isBusiness: hh?.kind === "business",
      startYm,
      horizonMonths: horizon,
      monthlyIncome: Math.round(monthlyIncome),
      salaryMonthly: Math.round(salaryMonthly),
      otherIncomeMonthly: Math.round(otherIncomeMonthly),
      monthlyCosts: Math.round(monthlyCosts),
      current: {
        netWorth: Math.round(assetsTotal + startingSavings - debts.reduce((s, d) => s + d.balance, 0)),
        savings: Math.round(startingSavings),
        assets: Math.round(assetsTotal),
      },
      scenarios,
    };
  });

const jobScenario = z.object({
  id: z.string().min(1).max(40),
  // Omit both to keep the current salary (the baseline "stay put" line).
  changeMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  newMonthlySalary: z.number().min(0).max(10_000_000).optional(),
  label: z.string().max(40).optional(),
});

/**
 * Job / salary change comparison: roll the household forward under one or more
 * "from month X, salary becomes Y" scenarios (a raise, a pay cut, a new job, or
 * simply staying put) so a user can weigh an offer against their current path.
 * Same salary-aware engine as the retirement view.
 */
export const jobChangeCompare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        horizonMonths: z.number().int().min(12).max(480).optional().default(120),
        savingsReturnAnnualPct: z.number().min(0).max(15).optional(),
        scenarios: z.array(jobScenario).min(1).max(3),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertHouseholdMember(supabase, data.householdId, context.userId);
    const hid = data.householdId;

    const [
      { data: hh },
      { data: incomes },
      { data: fixed },
      { data: variable },
      { data: debtsData },
      { data: plansData },
      { data: buckets },
      { data: allocs },
      { data: moves },
      { data: assetsData },
    ] = await Promise.all([
      supabase.from("households").select("currency, kind").eq("id", hid).maybeSingle(),
      supabase.from("incomes").select("monthly_amount, type").eq("household_id", hid),
      supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", hid),
      supabase.from("variable_estimates").select("monthly_amount").eq("household_id", hid),
      supabase.from("debts").select("*").eq("household_id", hid),
      supabase
        .from("plans")
        .select("id, label, amount, actual_amount, direction, month, recurrence, category, bucket_id, done")
        .eq("household_id", hid),
      supabase.from("buckets").select("id, initial_balance").eq("household_id", hid),
      supabase.from("bucket_allocations").select("bucket_id, amount").eq("household_id", hid),
      supabase
        .from("account_movements")
        .select("*")
        .eq("household_id", hid)
        .or("to_type.eq.bucket,from_type.eq.bucket"),
      supabase.from("assets").select("current_value, bucket_id").eq("household_id", hid),
    ]);

    const incomeRows = rowsOrEmpty<{ monthly_amount: number | string; type: string | null }>(incomes);
    const monthlyIncome = incomeRows.reduce((s, r) => s + Number(r.monthly_amount || 0), 0);
    const salaryMonthly = incomeRows
      .filter((r) => (r.type ?? "") === "salary")
      .reduce((s, r) => s + Number(r.monthly_amount || 0), 0);

    const sum = (rows: unknown): number =>
      rowsOrEmpty<{ monthly_amount: number | string }>(rows as never).reduce(
        (s, r) => s + Number(r.monthly_amount || 0),
        0,
      );
    const fixedNonDebtMonthly = sum(fixed);
    const variableMonthly = sum(variable);

    const debtRows = rowsOrEmpty<Debt>(debtsData);
    const debtMonthly = debtRows.reduce((s, d) => s + Number(d.monthly_amount || 0), 0);
    const debts: ProjectionDebt[] = debtRows
      .map((d) => ({
        id: d.id,
        label: d.label,
        balance: Number(d.principal_remaining ?? d.starting_principal ?? 0),
        monthlyRate: debtMonthlyRate(d),
        installment: Number(d.monthly_amount || 0),
      }))
      .filter((d) => d.balance > 0 && d.installment > 0);

    const bucketRows = rowsOrEmpty<{ id: string; initial_balance: number | string }>(buckets);
    const balances = bucketBalancesFor(
      bucketRows.map((b) => ({ id: b.id, initial_balance: b.initial_balance })),
      rowsOrEmpty<{ bucket_id: string; amount: number | string }>(allocs),
      rowsOrEmpty<AccountMovement>(moves),
    );
    const assetRows = rowsOrEmpty<{ current_value: number | string; bucket_id: string | null }>(
      assetsData,
    );
    const assetsTotal = assetRows.reduce((s, a) => s + Number(a.current_value || 0), 0);
    const linkedBucketIds = new Set(assetRows.map((a) => a.bucket_id).filter((x): x is string => !!x));
    let startingSavings = 0;
    for (const b of bucketRows) {
      const bal = balances[b.id] ?? 0;
      if (!linkedBucketIds.has(b.id)) startingSavings += bal;
    }

    const horizon = Math.min(480, data.horizonMonths);
    const baseInput: ProjectionInput = {
      startMonth: new Date(),
      months: horizon,
      maxMonths: horizon,
      monthlyIncome,
      salaryMonthly,
      fixedNonDebtMonthly,
      variableMonthly,
      debts,
      plans: rowsOrEmpty<Plan>(plansData as Plan[] | null),
      startingSavings,
      assetsTotal,
    };
    const monthlyCosts = fixedNonDebtMonthly + variableMonthly + debtMonthly;

    const startYmVal = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    const scenarioSet = scenarioSetForReturn(data.savingsReturnAnnualPct);
    const scenarios = data.scenarios.map((sc) => {
      const hasChange = sc.newMonthlySalary != null && !!sc.changeMonth;
      const events: ScenarioEvent[] =
        hasChange
          ? [{ id: sc.id, kind: "salary_change", month: sc.changeMonth!, newMonthlySalary: sc.newMonthlySalary!, label: sc.label }]
          : [];
      const fromYm = sc.changeMonth ?? startYmVal;
      const range = projectScenarios({ ...baseInput, events }, scenarioSet);
      const expected = range.expected;
      const afterChange = expected.find((m) => m.ym >= fromYm) ?? expected[0];
      const runout = expected.find((m) => m.ym >= fromYm && m.savings < 0)?.ym ?? null;
      const end = expected[expected.length - 1];
      const series = expected
        .filter((_, i) => i % 3 === 0 || i === expected.length - 1)
        .map((m) => ({ ym: m.ym, netWorth: m.netWorth, savings: m.savings }));
      return {
        id: sc.id,
        label: sc.label ?? "",
        changeMonth: sc.changeMonth,
        newMonthlySalary: sc.newMonthlySalary,
        series,
        endNetWorth: {
          expected: Math.round(end?.netWorth ?? 0),
          cautious: Math.round(range.cautious[range.cautious.length - 1]?.netWorth ?? 0),
          optimistic: Math.round(range.optimistic[range.optimistic.length - 1]?.netWorth ?? 0),
        },
        postChangeMonthlyIncome: Math.round(afterChange?.income ?? 0),
        postChangeMonthlySurplus: Math.round(afterChange?.surplus ?? 0),
        savingsRunoutYm: runout,
      };
    });

    const now = new Date();
    const startYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    return {
      currency: hh?.currency ?? "EUR",
      isBusiness: hh?.kind === "business",
      startYm,
      horizonMonths: horizon,
      monthlyIncome: Math.round(monthlyIncome),
      salaryMonthly: Math.round(salaryMonthly),
      monthlyCosts: Math.round(monthlyCosts),
      current: {
        netWorth: Math.round(assetsTotal + startingSavings - debts.reduce((s, d) => s + d.balance, 0)),
        savings: Math.round(startingSavings),
      },
      scenarios,
    };
  });
