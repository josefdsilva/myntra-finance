import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { buildCyclesFromSalaries, type CycleSpan } from "@/lib/cycle";
import { assertHouseholdMember, type Supa } from "@/lib/household-guard.server";
import { rowsOrEmpty } from "@/lib/query-utils";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "./ai-gateway.server";
import { estimateTextCredits, logHouseholdCredits } from "./credits.server";

const MODEL = "google/gemini-3-flash-preview";
// How many closed cycles (including the one being reported on) feed the
// variable-estimate suggestions — "current and previous cycles" per the brief.
const SUGGESTION_LOOKBACK = 3;

type ExpenseRow = {
  amount: number | string;
  category: string;
  kind: string;
  note: string | null;
  occurred_at: string;
};
type AllocRow = { bucket_id: string; amount: number | string };
type BucketRow = {
  id: string;
  name: string;
  target_type: string;
  target_value: number | string;
  target_deadline: string | null;
  initial_balance: number | string;
};
type EstimateRow = {
  id: string;
  label: string;
  category: string | null;
  monthly_amount: number | string;
};

export type CategoryReportRow = {
  category: string;
  estimateId: string | null;
  estimateLabel: string;
  estimate: number;
  actualMonthly: number;
  delta: number;
  suggested: number;
};

export type BucketReportRow = {
  id: string;
  name: string;
  targetType: string;
  allocatedThisCycle: number;
  currentBalance: number;
};

export type ClosedCycleStats = {
  cycleStart: string;
  cycleEnd: string;
  cycleDays: number;
  currency: string;
  baseline: number;
  fixedMonthly: number;
  actualIncome: number;
  actualVariableSpent: number;
  variablePool: number;
  confirmedBucketAllocations: number;
  leftoverSurplus: number;
  categories: CategoryReportRow[];
  buckets: BucketReportRow[];
  topSpends: Array<{ amount: number; category: string; note: string | null; occurred_at: string }>;
  trend: Array<{ start: string; end: string; variableSpentMonthly: number }>;
};

async function sumExpenses(
  supabase: Supa,
  householdId: string,
  start: Date,
  end: Date,
): Promise<{
  income: number;
  spent: number;
  byCategory: Record<string, number>;
  rows: ExpenseRow[];
}> {
  const { data } = await supabase
    .from("expenses")
    .select("amount, category, kind, note, occurred_at")
    .eq("household_id", householdId)
    .gte("occurred_at", start.toISOString())
    .lt("occurred_at", end.toISOString());
  const rows = rowsOrEmpty<ExpenseRow>(data);
  let income = 0;
  let spent = 0;
  const byCategory: Record<string, number> = {};
  for (const r of rows) {
    const amt = Number(r.amount);
    if (r.kind === "income") {
      income += amt;
    } else {
      spent += amt;
      byCategory[r.category] = (byCategory[r.category] ?? 0) + amt;
    }
  }
  return { income, spent, byCategory, rows };
}

/**
 * Build the full deterministic snapshot for one already-closed pay cycle:
 * actual income/spend vs. the household's current baseline & estimates,
 * per-category actual-vs-estimate with a suggested new estimate (average of
 * this cycle + up to SUGGESTION_LOOKBACK-1 prior closed cycles), bucket
 * balances, and the leftover cash once fixed + variable + bucket moves are
 * accounted for. Everything here is recomputed live — nothing is cached —
 * so it always reflects the current state of past expenses/estimates/buckets.
 */
export async function buildClosedCycleStats(
  supabase: Supa,
  householdId: string,
  cycle: CycleSpan,
  priorCycles: CycleSpan[],
): Promise<ClosedCycleStats> {
  const [{ data: hh }, { data: fixed }, { data: debts }, { data: estimates }, { data: buckets }] =
    await Promise.all([
      supabase
        .from("households")
        .select("currency, baseline_budget")
        .eq("id", householdId)
        .maybeSingle(),
      supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", householdId),
      supabase.from("debts").select("monthly_amount").eq("household_id", householdId),
      supabase
        .from("variable_estimates")
        .select("id, label, category, monthly_amount")
        .eq("household_id", householdId),
      supabase
        .from("buckets")
        .select("id, name, target_type, target_value, target_deadline, initial_balance")
        .eq("household_id", householdId)
        .order("sort_order"),
    ]);

  const fixedMonthly =
    rowsOrEmpty<{ monthly_amount: number | string }>(fixed).reduce(
      (s, r) => s + Number(r.monthly_amount),
      0,
    ) +
    rowsOrEmpty<{ monthly_amount: number | string }>(debts).reduce(
      (s, r) => s + Number(r.monthly_amount),
      0,
    );
  const baseline = Number(hh?.baseline_budget ?? 0);
  const currency = hh?.currency ?? "EUR";
  const variablePool = Math.max(0, baseline - fixedMonthly);

  const cycleDays = Math.max(
    1,
    Math.round((cycle.end.getTime() - cycle.start.getTime()) / 86400000),
  );
  const monthScale = 30 / cycleDays;

  const [{ income, spent, byCategory, rows }, { data: allocsThisCycle }, { data: allAllocs }] =
    await Promise.all([
      sumExpenses(supabase, householdId, cycle.start, cycle.end),
      supabase
        .from("bucket_allocations")
        .select("bucket_id, amount")
        .eq("household_id", householdId)
        .gte("confirmed_at", cycle.start.toISOString())
        .lt("confirmed_at", cycle.end.toISOString()),
      supabase
        .from("bucket_allocations")
        .select("bucket_id, amount")
        .eq("household_id", householdId),
    ]);

  const allocByBucket: Record<string, number> = {};
  for (const a of rowsOrEmpty<AllocRow>(allocsThisCycle)) {
    allocByBucket[a.bucket_id] = (allocByBucket[a.bucket_id] ?? 0) + Number(a.amount);
  }
  const confirmedBucketAllocations = Object.values(allocByBucket).reduce((s, n) => s + n, 0);
  const totalByBucket: Record<string, number> = {};
  for (const a of rowsOrEmpty<AllocRow>(allAllocs)) {
    totalByBucket[a.bucket_id] = (totalByBucket[a.bucket_id] ?? 0) + Number(a.amount);
  }

  const bucketRows: BucketReportRow[] = rowsOrEmpty<BucketRow>(buckets).map((b) => ({
    id: b.id,
    name: b.name,
    targetType: b.target_type,
    allocatedThisCycle: allocByBucket[b.id] ?? 0,
    currentBalance: Number(b.initial_balance ?? 0) + (totalByBucket[b.id] ?? 0),
  }));

  // Lookback cycles for the suggestion average: this cycle + the most recent
  // prior closed ones, oldest excluded once we have SUGGESTION_LOOKBACK total.
  const lookbackCycles = [...priorCycles.slice(-(SUGGESTION_LOOKBACK - 1)), cycle];
  const perCycleCategoryMonthly: Array<Record<string, number>> = [];
  for (const c of lookbackCycles) {
    if (c.start.getTime() === cycle.start.getTime()) {
      const scale = 30 / cycleDays;
      const scaled: Record<string, number> = {};
      for (const [k, v] of Object.entries(byCategory)) scaled[k] = v * scale;
      perCycleCategoryMonthly.push(scaled);
    } else {
      const days = Math.max(1, Math.round((c.end.getTime() - c.start.getTime()) / 86400000));
      const { byCategory: cat } = await sumExpenses(supabase, householdId, c.start, c.end);
      const scale = 30 / days;
      const scaled: Record<string, number> = {};
      for (const [k, v] of Object.entries(cat)) scaled[k] = v * scale;
      perCycleCategoryMonthly.push(scaled);
    }
  }
  const allCategoryNames = new Set<string>([
    ...Object.keys(byCategory),
    ...rowsOrEmpty<EstimateRow>(estimates).map((e) => e.category ?? e.label),
  ]);
  const categories: CategoryReportRow[] = [...allCategoryNames].map((category) => {
    const est = rowsOrEmpty<EstimateRow>(estimates).find(
      (e) => (e.category ?? e.label) === category,
    );
    const actualMonthly = Math.round((byCategory[category] ?? 0) * monthScale * 100) / 100;
    const samples = perCycleCategoryMonthly.map((m) => m[category] ?? 0);
    const suggested =
      samples.length > 0
        ? Math.round((samples.reduce((s, n) => s + n, 0) / samples.length) * 100) / 100
        : actualMonthly;
    const estimate = Number(est?.monthly_amount ?? 0);
    return {
      category,
      estimateId: est?.id ?? null,
      estimateLabel: est?.label ?? category,
      estimate,
      actualMonthly,
      delta: Math.round((actualMonthly - estimate) * 100) / 100,
      suggested,
    };
  });
  categories.sort((a, b) => b.actualMonthly - a.actualMonthly);

  const topSpends = rows
    .filter((r) => r.kind !== "income")
    .map((r) => ({
      amount: Number(r.amount),
      category: r.category,
      note: r.note,
      occurred_at: r.occurred_at,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const leftoverSurplus =
    Math.round((income - fixedMonthly - spent - confirmedBucketAllocations) * 100) / 100;

  const trend = await Promise.all(
    [...priorCycles.slice(-2), cycle].map(async (c) => {
      if (c.start.getTime() === cycle.start.getTime()) {
        return {
          start: c.start.toISOString(),
          end: c.end.toISOString(),
          variableSpentMonthly: Math.round(spent * monthScale * 100) / 100,
        };
      }
      const days = Math.max(1, Math.round((c.end.getTime() - c.start.getTime()) / 86400000));
      const { spent: s } = await sumExpenses(supabase, householdId, c.start, c.end);
      return {
        start: c.start.toISOString(),
        end: c.end.toISOString(),
        variableSpentMonthly: Math.round(s * (30 / days) * 100) / 100,
      };
    }),
  );

  return {
    cycleStart: cycle.start.toISOString(),
    cycleEnd: cycle.end.toISOString(),
    cycleDays,
    currency,
    baseline,
    fixedMonthly,
    actualIncome: income,
    actualVariableSpent: spent,
    variablePool,
    confirmedBucketAllocations,
    leftoverSurplus,
    categories,
    buckets: bucketRows,
    topSpends,
    trend,
  };
}

const LANG_NAMES: Record<string, string> = {
  en: "English",
  pt: "Portuguese",
  es: "Spanish",
  de: "German",
  fr: "French",
};
function langInstruction(locale?: string) {
  if (!locale || !LANG_NAMES[locale] || locale === "en") return "";
  return `\n\nRespond entirely in ${LANG_NAMES[locale]}. Translate all headings and labels naturally into ${LANG_NAMES[locale]}. Keep the currency symbol € and numeric values as-is.`;
}

const SYSTEM = `You are a warm, practical household financial coach writing the narrative section of a closed-pay-cycle report for a family in Portugal. Currency EUR.
Ground every claim in the JSON snapshot provided — never invent numbers, categories, or bucket names that aren't in it.
Format money as €X,XXX.XX. Output markdown with exactly two sections:
### What went well
2–4 short bullets — specific, grounded in the numbers (e.g. a category that came in under estimate, a bucket that got funded, income covering baseline comfortably).
### Areas to improve
2–4 short bullets — specific, actionable (e.g. a category that ran over, a bucket that missed its confirmation, an estimate that's drifted from actual spend).
If something is genuinely fine and there is nothing to flag in a section, say so briefly rather than inventing a nitpick.
Keep the whole thing under ~180 words. No preamble, no closing summary line, just the two sections.`;

/**
 * Get the cached narrative for a closed cycle, or generate + cache it.
 * Unlike the live coach overview, closed-cycle data never changes on its own,
 * so this has no TTL — pass refresh=true to force regeneration (e.g. after
 * correcting a past expense).
 */
export const generateCycleReportNarrative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        cycleStart: z.string().datetime(),
        cycleEnd: z.string().datetime(),
        refresh: z.boolean().optional(),
        locale: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHouseholdMember(supabase, data.householdId, userId);

    const { data: salaryRows } = await supabase
      .from("expenses")
      .select("occurred_at")
      .eq("household_id", data.householdId)
      .eq("is_salary", true)
      .order("occurred_at", { ascending: true });
    const cycles = buildCyclesFromSalaries(
      rowsOrEmpty<{ occurred_at: string }>(salaryRows).map((r) => r.occurred_at),
    );
    const idx = cycles.findIndex((c) => c.start.toISOString() === data.cycleStart);
    if (idx === -1) throw new Error("That cycle could not be found for this household.");
    const cycle = cycles[idx];
    const priorCycles = cycles.slice(0, idx);

    const stats = await buildClosedCycleStats(supabase, data.householdId, cycle, priorCycles);

    const cycleStartKey = cycle.start.toISOString().slice(0, 10);
    const useCache = !data.locale || data.locale === "en";

    if (!data.refresh && useCache) {
      const { data: cached } = await supabase
        .from("cycle_reports")
        .select("narrative, generated_at, model")
        .eq("household_id", data.householdId)
        .eq("cycle_start", cycleStartKey)
        .maybeSingle();
      if (cached) {
        return {
          narrative: cached.narrative as string,
          generated_at: cached.generated_at as string,
          model: cached.model as string | null,
          cached: true,
          stats,
        };
      }
    }

    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
    const result = await generateText({
      model: gateway(MODEL),
      system: SYSTEM + langInstruction(data.locale),
      prompt: `Closed-cycle snapshot (JSON):\n${JSON.stringify(stats)}\n\nWrite the report narrative now.`,
    });

    const est = estimateTextCredits(MODEL, result.usage as never);
    await logHouseholdCredits({
      householdId: data.householdId,
      userId,
      operation: "ai_cycle_report",
      credits: est.credits,
      inputTokens: est.input,
      outputTokens: est.output,
    });

    const generated_at = new Date().toISOString();
    if (useCache) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("cycle_reports").upsert({
        household_id: data.householdId,
        cycle_start: cycleStartKey,
        narrative: result.text,
        model: MODEL,
        generated_at,
      });
    }

    return { narrative: result.text, generated_at, model: MODEL, cached: false, stats };
  });
