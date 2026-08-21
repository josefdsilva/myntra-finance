import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertHouseholdMember } from "@/lib/household-guard.server";
import { rowsOrEmpty } from "@/lib/query-utils";
import { z } from "zod";
import { debtMonthlyRate, debtLiveSchedule, type Debt } from "@/lib/debt-schedule";
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
    // Which salary income this retires (server resolves the amount). Omit to
    // retire the whole salary total (single earner).
    replacesIncomeId: z.string().max(64).optional(),
    label: z.string().max(80).optional(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("salary_change"),
    month: ym,
    newMonthlySalary: z.number().min(0).max(10_000_000),
    replacesIncomeId: z.string().max(64).optional(),
    label: z.string().max(80).optional(),
  }),
]);

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
 * in projection.ts — this only gathers the inputs. Scenario events include
 * retirement (salary -> pension) and salary_change (a new job / raise / cut).
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
      supabase.from("incomes").select("id, label, monthly_amount, type").eq("household_id", hid),
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
    const incomeRows = rowsOrEmpty<{
      id: string;
      label: string | null;
      monthly_amount: number | string;
      type: string | null;
    }>(incomes);
    const monthlyIncome = incomeRows.reduce((s, r) => s + Number(r.monthly_amount || 0), 0);
    const salaryRows = incomeRows.filter((r) => (r.type ?? "") === "salary");
    const salaryMonthly = salaryRows.reduce((s, r) => s + Number(r.monthly_amount || 0), 0);
    // Salary incomes the UI can target with a retirement / salary-change event.
    const salaryIncomes = salaryRows.map((r) => ({
      id: r.id,
      label: r.label ?? "Salary",
      monthly: Math.round(Number(r.monthly_amount || 0) * 100) / 100,
    }));
    const fixedNonDebtMonthly = sum(fixed);
    const variableMonthly = sum(variable);

    const debtRows = rowsOrEmpty<Debt>(debtsData);
    const debtMonthly = debtRows.reduce((s, d) => s + Number(d.monthly_amount || 0), 0);
    // Start from TODAY's live amortized balance (same basis as the Net Worth
    // card), not the stale stored principal, so projected net worth matches.
    const debts: ProjectionDebt[] = debtRows
      .map((d) => {
        const live = debtLiveSchedule(d);
        return {
          id: d.id,
          label: d.label,
          balance: live.remaining,
          monthlyRate: debtMonthlyRate(d),
          installment: live.installment,
        };
      })
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

    // Resolve which salary each retirement / salary-change event replaces. A
    // targeted event replaces just that income; an untargeted one replaces the
    // whole salary total (single earner).
    const events = (data.events ?? []).map((e) => {
      if (e.kind === "retirement" || e.kind === "salary_change") {
        const replacesMonthly = e.replacesIncomeId
          ? Number(salaryIncomes.find((s) => s.id === e.replacesIncomeId)?.monthly ?? 0)
          : salaryMonthly;
        return { ...e, replacesMonthly };
      }
      return e;
    }) as ScenarioEvent[];
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

    // Long horizons (retirement can be 40y = 480 monthly points × 4 series) make
    // the payload heavy. Downsample to ~monthly-for-short, ~yearly-for-long while
    // always keeping the final point exact. Short horizons pass through unchanged.
    const downsample = <T,>(arr: T[]): T[] => {
      if (arr.length <= 121) return arr;
      const step = Math.ceil(arr.length / 120);
      const out = arr.filter((_, i) => i % step === 0);
      if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
      return out;
    };

    const scenarioSeries = projectScenarios(baseInput);
    const keys: ScenarioKey[] = ["expected", "cautious", "optimistic"];
    const scenarios = keys.map((key) => {
      const full = scenarioSeries[key];
      return { key, series: downsample(full), at: full[full.length - 1] };
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
    const baseline = {
      series: downsample(baselineSeries),
      at: baselineSeries[baselineSeries.length - 1],
    };

    const projects = projectProjects(projectsInput, months);

    const startYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    // The month the projection actually reaches (start + clamped horizon), so the
    // UI's headline date always matches the numbers even if a far date was asked.
    const effTarget = new Date(now.getFullYear(), now.getMonth() + months, 1);
    const targetYm = `${effTarget.getFullYear()}-${String(effTarget.getMonth() + 1).padStart(2, "0")}`;

    return {
      currency: hh?.currency ?? "EUR",
      startYm,
      targetYm,
      months,
      current: {
        netWorth: Math.round((assetsTotal + startingSavings - debts.reduce((s, d) => s + d.balance, 0)) * 100) / 100,
        savings: Math.round(startingSavings * 100) / 100,
        assets: Math.round(assetsTotal * 100) / 100,
        debtRemaining: Math.round(debts.reduce((s, d) => s + d.balance, 0) * 100) / 100,
        monthlySurplus:
          Math.round(
            Math.max(
              0,
              monthlyIncome -
                (Number(hh?.baseline_budget) || fixedNonDebtMonthly + variableMonthly + debtMonthly),
            ) * 100,
          ) / 100,
      },
      scenarios,
      baseline,
      hasEvents: events.length > 0,
      projects,
      // Existing debts an overpayment can target.
      debts: debts.map((d) => ({ id: d.id, label: d.label })),
      // Salary incomes a retirement / salary-change event can replace.
      salaryIncomes,
    };
  });
