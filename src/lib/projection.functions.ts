import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertHouseholdMember } from "@/lib/household-guard.server";
import { rowsOrEmpty } from "@/lib/query-utils";
import { z } from "zod";
import { debtMonthlyRate, type Debt } from "@/lib/debt-schedule";
import { bucketBalancesFor, type AccountMovement } from "@/lib/movements";
import type { Plan } from "@/lib/plan";
import {
  projectScenarios,
  projectProjects,
  monthsBetween,
  MAX_PROJECTION_MONTHS,
  type ProjectionInput,
  type ProjectionDebt,
  type ProjectionProject,
  type ScenarioKey,
} from "@/lib/projection";

/** Months from now until the first of `targetYm` (YYYY-MM), clamped to the cap. */
function monthsToTarget(targetYm: string): number {
  const [y, m] = targetYm.split("-").map(Number);
  const target = new Date(y, (m || 1) - 1, 1);
  const now = new Date();
  return Math.max(1, Math.min(MAX_PROJECTION_MONTHS, monthsBetween(now, target)));
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
      supabase.from("incomes").select("monthly_amount").eq("household_id", hid),
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
    const fixedNonDebtMonthly = sum(fixed);
    const variableMonthly = sum(variable);

    const debtRows = rowsOrEmpty<Debt>(debtsData);
    const debtMonthly = debtRows.reduce((s, d) => s + Number(d.monthly_amount || 0), 0);
    const debts: ProjectionDebt[] = debtRows
      .map((d) => ({
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

    const baseInput: ProjectionInput = {
      startMonth: now,
      months,
      monthlyIncome,
      fixedNonDebtMonthly,
      variableMonthly,
      debts,
      plans: rowsOrEmpty<Plan>(plansData as Plan[] | null),
      startingSavings,
      assetsTotal,
    };

    const scenarioSeries = projectScenarios(baseInput);
    const keys: ScenarioKey[] = ["expected", "cautious", "optimistic"];
    const scenarios = keys.map((key) => {
      const series = scenarioSeries[key];
      return { key, series, at: series[series.length - 1] };
    });

    const projects = projectProjects(projectsInput, months);

    const [ty, tm] = data.targetMonth.split("-").map(Number);
    const startYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    return {
      currency: hh?.currency ?? "EUR",
      isBusiness: hh?.kind === "business",
      startYm,
      targetYm: `${ty}-${String(tm).padStart(2, "0")}`,
      months,
      current: {
        netWorth: Math.round((assetsTotal + startingSavings - debts.reduce((s, d) => s + d.balance, 0)) * 100) / 100,
        savings: Math.round(startingSavings * 100) / 100,
        assets: Math.round(assetsTotal * 100) / 100,
        debtRemaining: Math.round(debts.reduce((s, d) => s + d.balance, 0) * 100) / 100,
        monthlySurplus: Math.round((monthlyIncome - fixedNonDebtMonthly - variableMonthly - debtMonthly) * 100) / 100,
      },
      scenarios,
      projects,
    };
  });
