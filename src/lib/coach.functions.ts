import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { computeCycle } from "@/lib/cycle";
import { assertHouseholdMember, type Supa } from "@/lib/household-guard.server";
import { rowsOrEmpty } from "@/lib/query-utils";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "./ai-gateway.server";
import { estimateTextCredits, logHouseholdCredits } from "./credits.server";

const MODEL = "google/gemini-3-flash-preview";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// Narrow row shapes used only to aggregate the coach snapshot. Kept local so a
// schema tweak on unrelated columns doesn't force this file to change.
type SalaryRow = { occurred_at: string };
type ExpenseRow = {
  amount: number | string;
  category: string;
  kind: string;
  note: string | null;
  occurred_at: string;
};
type PrevExpenseRow = Pick<ExpenseRow, "amount" | "kind" | "category">;
type MonthlyRow = { monthly_amount: number | string };
type BucketRow = {
  id: string;
  name: string;
  target_type: string;
  target_value: number | string;
  target_deadline: string | null;
};
type AllocRow = { bucket_id: string; amount: number | string; confirmed_at: string };
type AllAllocRow = { bucket_id: string; amount: number | string };

type CoachContext = {
  today: string;
  currency: string;
  baseline: number;
  marginPct: number;
  cycle: {
    source: string;
    start: string;
    end: string;
    daysTotal: number;
    daysLeft: number;
    predicted: boolean;
  };
  fixedMonthly: number;
  variableEstimateMonthly: number;
  /** Rough recurring income per month, averaged from up to 6 recent salary events. */
  estimatedMonthlyIncome: number;
  /** estimatedMonthlyIncome - fixedMonthly - variableEstimateMonthly. Room for new commitments. */
  monthlySurplus: number;
  /** Conservative safe monthly payment for a new recurring commitment (rent, loan, lease). */
  safeNewMonthlyCommitment: number;
  /** Lifetime savings across all buckets (sum of confirmed allocations). */
  totalSavings: number;
  cycleTotals: {
    spent: number;
    received: number;
    net: number;
    byCategory: Record<string, number>;
  };
  previousCycleTotals: {
    spent: number;
    received: number;
    net: number;
  } | null;
  buckets: Array<{
    name: string;
    target_type: string;
    target_value: number;
    target_deadline: string | null;
    allocatedThisCycle: number;
    totalSaved: number;
  }>;
  topSpends: Array<{ amount: number; category: string; note: string | null; occurred_at: string }>;
  cycleStartKey: string; // yyyy-mm-dd for cache
};


async function buildContext(supabase: Supa, householdId: string): Promise<CoachContext> {
  const { data: hh } = await supabase
    .from("households")
    .select("currency, baseline_budget, margin_pct")
    .eq("id", householdId)
    .maybeSingle();

  const { data: salaryRows } = await supabase
    .from("expenses")
    .select("occurred_at")
    .eq("household_id", householdId)
    .eq("is_salary", true)
    .order("occurred_at", { ascending: false })
    .limit(6);

  const salaryDatesDesc = rowsOrEmpty<SalaryRow>(salaryRows).map((r) => r.occurred_at);
  const cycle = computeCycle(salaryDatesDesc);

  // Previous cycle bounds
  let prevStart: Date | null = null;
  let prevEnd: Date | null = null;
  if (salaryDatesDesc.length >= 2) {
    prevEnd = new Date(salaryDatesDesc[0]);
    prevStart = new Date(salaryDatesDesc[1]);
  }

  const startISO = cycle.start.toISOString();
  const endISO = cycle.end.toISOString();

  const { data: cycleExp } = await supabase
    .from("expenses")
    .select("amount, category, kind, note, occurred_at")
    .eq("household_id", householdId)
    .gte("occurred_at", startISO)
    .lt("occurred_at", endISO);

  let previousCycleTotals: CoachContext["previousCycleTotals"] = null;
  if (prevStart && prevEnd) {
    const { data: prevExp } = await supabase
      .from("expenses")
      .select("amount, kind, category")
      .eq("household_id", householdId)
      .gte("occurred_at", prevStart.toISOString())
      .lt("occurred_at", prevEnd.toISOString());
    let s = 0,
      r = 0;
    for (const e of rowsOrEmpty<PrevExpenseRow>(prevExp)) {
      const a = Number(e.amount);
      if (e.kind === "income") r += a;
      else s += a;
    }
    previousCycleTotals = { spent: s, received: r, net: s - r };
  }

  const [{ data: fixed }, { data: varEst }, { data: buckets }, { data: allocs }, { data: allAllocs }] =
    await Promise.all([
      supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", householdId),
      supabase.from("variable_estimates").select("monthly_amount").eq("household_id", householdId),
      supabase
        .from("buckets")
        .select("id, name, target_type, target_value, target_deadline")
        .eq("household_id", householdId),
      supabase
        .from("bucket_allocations")
        .select("bucket_id, amount, confirmed_at")
        .eq("household_id", householdId)
        .gte("confirmed_at", startISO)
        .lt("confirmed_at", endISO),
      supabase
        .from("bucket_allocations")
        .select("bucket_id, amount")
        .eq("household_id", householdId),
    ]);

  const sumMonthly = (rows: unknown): number =>
    rowsOrEmpty<MonthlyRow>(rows as MonthlyRow[] | null).reduce(
      (s, r) => s + Number(r.monthly_amount),
      0,
    );
  const fixedMonthly = sumMonthly(fixed);
  const variableEstimateMonthly = sumMonthly(varEst);

  const allocByBucket: Record<string, number> = {};
  for (const a of rowsOrEmpty<AllocRow>(allocs)) {
    allocByBucket[a.bucket_id] = (allocByBucket[a.bucket_id] ?? 0) + Number(a.amount);
  }
  const totalByBucket: Record<string, number> = {};
  let totalSavings = 0;
  for (const a of rowsOrEmpty<AllAllocRow>(allAllocs)) {
    const amt = Number(a.amount);
    totalByBucket[a.bucket_id] = (totalByBucket[a.bucket_id] ?? 0) + amt;
    totalSavings += amt;
  }

  let spent = 0,
    received = 0;
  const byCategory: Record<string, number> = {};
  const spendsForTop: Array<{
    amount: number;
    category: string;
    note: string | null;
    occurred_at: string;
  }> = [];
  for (const e of rowsOrEmpty<ExpenseRow>(cycleExp)) {
    const a = Number(e.amount);
    if (e.kind === "income") received += a;
    else {
      spent += a;
      byCategory[e.category] = (byCategory[e.category] ?? 0) + a;
      spendsForTop.push({
        amount: a,
        category: e.category,
        note: e.note,
        occurred_at: e.occurred_at,
      });
    }
  }
  spendsForTop.sort((a, b) => b.amount - a.amount);

  // Estimate monthly income from recent salary events (avg gap between events).
  let estimatedMonthlyIncome = 0;
  if (salaryDatesDesc.length >= 2) {
    // Pull matching salary amounts to average magnitude.
    const { data: salaryAmts } = await supabase
      .from("expenses")
      .select("amount, occurred_at")
      .eq("household_id", householdId)
      .eq("is_salary", true)
      .order("occurred_at", { ascending: false })
      .limit(6);
    const amts = rowsOrEmpty<{ amount: number | string }>(salaryAmts).map((r) => Number(r.amount));
    if (amts.length) {
      const avg = amts.reduce((s, n) => s + n, 0) / amts.length;
      // If gap between latest two salaries is ~28-31d assume monthly.
      const gapDays =
        (new Date(salaryDatesDesc[0]).getTime() - new Date(salaryDatesDesc[1]).getTime()) /
        86400000;
      const perMonth = gapDays > 0 ? avg * (30 / gapDays) : avg;
      estimatedMonthlyIncome = Math.round(perMonth * 100) / 100;
    }
  } else if (received > 0) {
    estimatedMonthlyIncome = received;
  }

  const monthlySurplus = Math.max(
    0,
    estimatedMonthlyIncome - fixedMonthly - variableEstimateMonthly,
  );
  // Conservative: leave 25% of surplus as buffer for savings / unexpected.
  const safeNewMonthlyCommitment = Math.round(monthlySurplus * 0.75 * 100) / 100;

  return {
    today: new Date().toISOString(),
    currency: hh?.currency ?? "EUR",
    baseline: Number(hh?.baseline_budget ?? 0),
    marginPct: Number(hh?.margin_pct ?? 0),
    cycle: {
      source: cycle.source,
      start: cycle.start.toISOString(),
      end: cycle.end.toISOString(),
      daysTotal: cycle.daysTotal,
      daysLeft: cycle.daysLeft,
      predicted: cycle.predicted,
    },
    fixedMonthly,
    variableEstimateMonthly,
    estimatedMonthlyIncome,
    monthlySurplus,
    safeNewMonthlyCommitment,
    totalSavings,
    cycleTotals: { spent, received, net: spent - received, byCategory },
    previousCycleTotals,
    buckets: rowsOrEmpty<BucketRow>(buckets).map((b) => ({
      name: b.name,
      target_type: b.target_type,
      target_value: Number(b.target_value),
      target_deadline: b.target_deadline,
      allocatedThisCycle: allocByBucket[b.id] ?? 0,
      totalSaved: totalByBucket[b.id] ?? 0,
    })),
    topSpends: spendsForTop.slice(0, 8),
    cycleStartKey: cycle.start.toISOString().slice(0, 10),
  };
}


const SYSTEM_BASE = `You are a warm, practical household financial coach for a family of four in Portugal. Currency EUR.
Ground every answer in the JSON snapshot the user provides — never invent numbers. If a number is missing say so and explain what you'd need.
Format money as €X,XXX.XX. Use markdown. Be concrete: give ranges, not vague advice.

You help with big life decisions as well as day-to-day budgeting. Common questions:
- Housing: "how much rent/mortgage can we afford?" — anchor on \`safeNewMonthlyCommitment\` and \`monthlySurplus\`; mention the 28/36 rule (housing ≤ ~28% of gross monthly income, total debt ≤ ~36%). Give a comfortable range and a stretch range. Flag if emergency savings are thin.
- Buying vs financing (car, appliance, etc.): compare (a) paying cash from savings (name the bucket, show remaining after purchase, note the emergency-fund impact), (b) a loan at a reasonable market rate (assume typical Portugal auto loan 7–10% APR, personal loan 8–12% APR, mortgage 3.5–5% — always caveat "typical, check current offers"), (c) leasing. Show approximate monthly payment ranges and total interest.
- Credit / debt: never encourage taking on debt that pushes total monthly commitments above \`safeNewMonthlyCommitment\`. Suggest concrete steps to free room (reduce a category, pause a bucket, delay purchase N months).
- Comparing credit / loan offers: when the user shares two or more offers (or asks you to size one up), always compare on the same footing. Show a small markdown table with columns: Offer, APR (TAEG in Portugal), monthly payment, total interest, total cost, term. Compute monthly payment with the standard amortization formula P = L · r / (1 − (1+r)^-n) where r = APR/12 and n = months; total cost = monthly · n. Call out fees, insurance requirements, early-repayment penalties, and variable-vs-fixed rate risk. Flag the "spread + Euribor" structure for Portuguese mortgages. Recommend the offer with the lowest total cost that still fits \`safeNewMonthlyCommitment\`, and remind the user that TAEG is the fair comparison metric (not the nominal rate).
- Comparing products / purchases (phones, appliances, cars, subscriptions, insurance, energy plans, etc.): put options side-by-side in a markdown table with price, key specs the user cares about, expected lifespan or contract length, and cost per year / per use. Include running costs (fuel/energy, subscription, maintenance) when they matter. End with one clear recommendation tied to the household's budget room and goals; suggest a "good enough" pick if the top option strains \`safeNewMonthlyCommitment\`. If the user hasn't shared numbers, ask for the 2–3 fields that would most change the answer.
- Savings goals: use bucket \`totalSaved\` and \`allocatedThisCycle\` to project when a goal is reachable.

When giving rate/market figures, always label them as typical benchmarks and remind the user to compare live quotes. Keep answers scannable: short intro, a small table when comparing 2+ options, 2–4 bullet points, one clear recommendation. Prefer 4–8 sentences for simple questions; go longer only when a comparison genuinely needs it.`;


const OVERVIEW_PROMPT = `Write a friendly financial overview in markdown with these sections:
### What's going well
2–4 short bullets grounded in the numbers.
### Watch outs
2–4 short bullets — categories overspending vs estimate, buckets falling behind, low days-left runway, etc.
### Recommendations
3 concrete, actionable suggestions for the rest of this cycle.
Keep the whole thing under ~220 words. No preamble.`;

const LANG_NAMES: Record<string, string> = {
  en: "English",
  pt: "Portuguese",
  es: "Spanish",
  de: "German",
  fr: "French",
};

function langInstruction(locale?: string) {
  if (!locale || !LANG_NAMES[locale] || locale === "en") return "";
  return `\n\nRespond entirely in ${LANG_NAMES[locale]}. Translate all headings, bullets, and money labels naturally into ${LANG_NAMES[locale]}. Keep the currency symbol € and numeric values as-is.`;
}

/** Get cached overview or generate. Pass refresh=true to force regenerate. */
export const generateOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        refresh: z.boolean().optional(),
        locale: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await assertHouseholdMember(supabase, data.householdId, userId);

    const ctx = await buildContext(supabase, data.householdId);
    const useCache = !data.locale || data.locale === "en";

    // Cache check (English only — cached content is stored in English)
    if (!data.refresh && useCache) {
      const { data: cached } = await supabase
        .from("analysis_overviews")
        .select("content, generated_at, model")
        .eq("household_id", data.householdId)
        .eq("cycle_start", ctx.cycleStartKey)
        .maybeSingle();
      if (cached) {
        const age = Date.now() - new Date(cached.generated_at).getTime();
        if (age < CACHE_TTL_MS) {
          return {
            content: cached.content as string,
            generated_at: cached.generated_at as string,
            model: cached.model as string | null,
            cached: true,
          };
        }
      }
    }

    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
    const result = await generateText({
      model: gateway(MODEL),
      system: SYSTEM_BASE + langInstruction(data.locale),
      prompt: `Household snapshot (JSON):\n${JSON.stringify(ctx)}\n\n${OVERVIEW_PROMPT}`,
    });

    const est = estimateTextCredits(MODEL, result.usage as never);
    await logHouseholdCredits({
      householdId: data.householdId,
      userId,
      operation: "ai_coach_overview",
      credits: est.credits,
      inputTokens: est.input,
      outputTokens: est.output,
    });

    const generated_at = new Date().toISOString();
    if (useCache) {
      // Upsert via admin (RLS blocks writes from client role)
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("analysis_overviews").upsert({
        household_id: data.householdId,
        cycle_start: ctx.cycleStartKey,
        content: result.text,
        model: MODEL,
        generated_at,
      });
    }

    return { content: result.text, generated_at, model: MODEL, cached: false };
  });

const ChatMsg = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
});

/** Ephemeral chat with the coach. Rebuilds context each call (cheap). */
export const chatWithCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        history: z.array(ChatMsg).max(20),
        message: z.string().min(1).max(2000),
        locale: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHouseholdMember(supabase, data.householdId, userId);

    const ctx = await buildContext(supabase, data.householdId);

    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
    const result = await generateText({
      model: gateway(MODEL),
      system: `${SYSTEM_BASE}${langInstruction(data.locale)}

Current household snapshot (JSON, always fresh):
${JSON.stringify(ctx)}

Answer the user's questions grounded in this snapshot. Use markdown when helpful. For quick questions stay short (2–5 sentences); for life-decision questions (housing, buying vs financing, taking on debt, big savings goals) give a more thorough answer with a range, an assumption line, and a clear recommendation.`,
      messages: [
        ...data.history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: data.message },
      ],
    });

    const est = estimateTextCredits(MODEL, result.usage as never);
    await logHouseholdCredits({
      householdId: data.householdId,
      userId,
      operation: "ai_coach_chat",
      credits: est.credits,
      inputTokens: est.input,
      outputTokens: est.output,
    });

    return { reply: result.text };
  });
