import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { computeCycle } from "@/lib/cycle";
import { assertHouseholdMember, type Supa } from "@/lib/household-guard.server";
import { rowsOrEmpty } from "@/lib/query-utils";
import { addMonths } from "date-fns";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "./ai-gateway.server";
import { computeBenchmarkComparison, type BenchmarkComparison } from "./benchmarks";
import { monthlyRateFromTaeg, monthlyRateFromNominalTan, termMonthsFor } from "./amortization";
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
  fixedExpensesMonthly: number;
  debtMonthly: number;
  debtPrincipalOutstanding: number;
  debts: Array<{
    label: string;
    kind: string;
    monthly_amount: number;
    taeg_pct: number | null;
    principal_remaining: number | null;
    maturity_date: string | null;
  }>;
  variableEstimateMonthly: number;
  /** Canonical monthly income = sum of Settings incomes (matches the app screens). */
  settingsIncome: number;
  /** Settings income − baseline (baseline includes fixed + debt + variable + margin). */
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
  benchmark: BenchmarkComparison | null;
  country: string;
  countryName: string;
  /** fixed (incl. debt) + variable estimate per month. */
  essentialsMonthly: number;
  /** totalSavings / essentialsMonthly, in months. Null if no expenses. */
  emergencyFundMonths: number | null;
  /** monthlySurplus / income, %. Null if no income. */
  savingsRatePct: number | null;
  /** debtMonthly / income, %. Null if no income. */
  debtToIncomePct: number | null;
  /** Per-debt payoff facts, pre-computed so the model never does amortization math. */
  debtProjections: Array<{
    label: string;
    aprPct: number;
    monthlyInstallment: number;
    scheduledPayoff: string | null;
    remainingInterest: number | null;
    /** Effect of paying an extra €100/mo. */
    overpay100MonthsSaved: number | null;
    overpay100InterestSaved: number | null;
  }>;
  /** Debt labels ordered highest-APR-first (pay this order to minimise interest). */
  avalancheOrder: string[];
  /** Debt labels ordered smallest-balance-first (pay this order for quick wins). */
  snowballOrder: string[];
  cycleStartKey: string; // yyyy-mm-dd for cache
};


async function buildContext(supabase: Supa, householdId: string): Promise<CoachContext> {
  const { data: hh } = await supabase
    .from("households")
    .select("currency, baseline_budget, margin_pct, country, adults, children")
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

  const [
    { data: fixed },
    { data: debtsData },
    { data: varEst },
    { data: buckets },
    { data: allocs },
    { data: allAllocs },
  ] = await Promise.all([
    supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", householdId),
    supabase
      .from("debts")
      .select(
        "label, kind, monthly_amount, taeg_pct, tan_pct, deduced_rate_pct, principal_remaining, maturity_date",
      )
      .eq("household_id", householdId),
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
  const fixedExpensesMonthly = sumMonthly(fixed);
  const debtMonthly = sumMonthly(debtsData);
  const fixedMonthly = fixedExpensesMonthly + debtMonthly;
  const variableEstimateMonthly = sumMonthly(varEst);
  // Canonical income = sum of Settings incomes. This single figure drives surplus,
  // savings rate, debt-to-income and the benchmark, matching every app screen.
  const { data: incomesRows } = await supabase
    .from("incomes")
    .select("monthly_amount")
    .eq("household_id", householdId);
  const settingsIncome = sumMonthly(incomesRows);
  const baseline = Number(hh?.baseline_budget ?? 0);
  type DebtRow = {
    label: string;
    kind: string;
    monthly_amount: number | string;
    taeg_pct: number | string | null;
    tan_pct: number | string | null;
    deduced_rate_pct: number | string | null;
    principal_remaining: number | string | null;
    maturity_date: string | null;
  };
  const debts = rowsOrEmpty<DebtRow>(debtsData).map((d) => ({
    label: d.label,
    kind: d.kind,
    monthly_amount: Number(d.monthly_amount),
    taeg_pct: d.taeg_pct == null ? null : Number(d.taeg_pct),
    principal_remaining: d.principal_remaining == null ? null : Number(d.principal_remaining),
    maturity_date: d.maturity_date,
  }));
  const debtPrincipalOutstanding = debts.reduce(
    (s, d) => s + (d.principal_remaining ?? 0),
    0,
  );

  // Pre-compute debt payoff facts in code so the model never does amortization
  // math itself. Rate preference mirrors the app: deduced > TAN > TAEG.
  const debtRows = rowsOrEmpty<DebtRow>(debtsData);
  const now = new Date();
  const rateOf = (d: DebtRow): number => {
    if (d.deduced_rate_pct != null) return monthlyRateFromTaeg(Number(d.deduced_rate_pct));
    if (d.tan_pct != null) return monthlyRateFromNominalTan(Number(d.tan_pct));
    return monthlyRateFromTaeg(Number(d.taeg_pct ?? 0));
  };
  const aprOf = (d: DebtRow): number =>
    d.deduced_rate_pct != null
      ? Number(d.deduced_rate_pct)
      : d.taeg_pct != null
        ? Number(d.taeg_pct)
        : d.tan_pct != null
          ? Number(d.tan_pct)
          : 0;
  const debtProjections = debtRows
    .filter((d) => Number(d.principal_remaining ?? 0) > 0 && Number(d.monthly_amount) > 0)
    .map((d) => {
      const principal = Number(d.principal_remaining);
      const installment = Number(d.monthly_amount);
      const r = rateOf(d);
      const n = termMonthsFor(principal, r, installment);
      const nOver = termMonthsFor(principal, r, installment + 100);
      return {
        label: d.label,
        aprPct: Math.round(aprOf(d) * 100) / 100,
        monthlyInstallment: installment,
        scheduledPayoff:
          d.maturity_date ?? (n ? addMonths(now, Math.ceil(n)).toISOString().slice(0, 10) : null),
        remainingInterest: n ? Math.round((installment * n - principal) * 100) / 100 : null,
        overpay100MonthsSaved: n && nOver ? Math.round(n - nOver) : null,
        overpay100InterestSaved:
          n && nOver ? Math.round((installment * n - (installment + 100) * nOver) * 100) / 100 : null,
      };
    });
  const avalancheOrder = debtRows
    .slice()
    .sort((a, b) => aprOf(b) - aprOf(a))
    .map((d) => d.label);
  const snowballOrder = debtRows
    .slice()
    .sort(
      (a, b) =>
        Number(a.principal_remaining ?? Number.POSITIVE_INFINITY) -
        Number(b.principal_remaining ?? Number.POSITIVE_INFINITY),
    )
    .map((d) => d.label);

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

  // Surplus matches the app: Settings income − baseline (baseline already includes
  // fixed + debt + variable + safety margin).
  const monthlySurplus = Math.max(0, settingsIncome - baseline);
  // Conservative: leave 25% of surplus as buffer for savings / unexpected.
  const safeNewMonthlyCommitment = Math.round(monthlySurplus * 0.75 * 100) / 100;

  const essentialsMonthly = Math.round((fixedMonthly + variableEstimateMonthly) * 100) / 100;
  const emergencyFundMonths =
    essentialsMonthly > 0 ? Math.round((totalSavings / essentialsMonthly) * 10) / 10 : null;
  const savingsRatePct =
    settingsIncome > 0 ? Math.round((monthlySurplus / settingsIncome) * 1000) / 10 : null;
  const debtToIncomePct =
    settingsIncome > 0 ? Math.round((debtMonthly / settingsIncome) * 1000) / 10 : null;

  // Normalize this cycle's category spend to a monthly footing so we can
  // compare against national category shares fairly.
  const cycleDays = Math.max(1, cycle.daysTotal || 30);
  const monthScale = 30 / cycleDays;
  const monthlySpendByCategory: Record<string, number> = {};
  for (const [k, v] of Object.entries(byCategory)) {
    monthlySpendByCategory[k] = Math.round(v * monthScale * 100) / 100;
  }
  const totalMonthlySpend =
    Math.round((spent * monthScale + fixedMonthly + variableEstimateMonthly) * 100) / 100;
  // Benchmark uses the canonical Settings income, the same figure that drives
  // surplus and every screen — so the coach and the Benchmarks card agree.
  const benchmark =
    settingsIncome > 0
      ? computeBenchmarkComparison({
          country: hh?.country ?? "PT",
          adults: Number(hh?.adults ?? 2),
          children: Number(hh?.children ?? 0),
          monthlyIncome: settingsIncome,
          monthlySpend: totalMonthlySpend,
          spendByCategory: monthlySpendByCategory,
        })
      : null;

  return {
    today: new Date().toISOString(),
    currency: hh?.currency ?? "EUR",
    baseline,
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
    fixedExpensesMonthly,
    debtMonthly,
    debts,
    debtPrincipalOutstanding,
    variableEstimateMonthly,
    settingsIncome,
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
    benchmark,
    country: (hh?.country ?? "PT").toUpperCase(),
    countryName: COUNTRY_NAMES[(hh?.country ?? "PT").toUpperCase()] ?? (hh?.country ?? "PT"),
    essentialsMonthly,
    emergencyFundMonths,
    savingsRatePct,
    debtToIncomePct,
    debtProjections,
    avalancheOrder,
    snowballOrder,
    cycleStartKey: cycle.start.toISOString().slice(0, 10),
  };
}


const RATES_AS_OF = "July 2026";

const COUNTRY_NAMES: Record<string, string> = {
  PT: "Portugal",
  ES: "Spain",
  FR: "France",
  DE: "Germany",
  IT: "Italy",
  NL: "Netherlands",
  IE: "Ireland",
  BE: "Belgium",
  AT: "Austria",
  LU: "Luxembourg",
};

type RateBlock = { auto: string; personal: string; mortgage: string; savings: string; note?: string };
const GENERIC_RATES: RateBlock = {
  auto: "~7-11% APR",
  personal: "~8-13% APR",
  mortgage: "~3.5-5.5%",
  savings: "~2-3.5% net",
};
const MARKET_RATES: Record<string, RateBlock> = {
  PT: {
    auto: "7-10% APR",
    personal: "8-12% APR",
    mortgage: "3.5-5% (Euribor + spread)",
    savings: "~2.5-3.5% net",
    note: "Portuguese mortgage early-repayment fees are legally capped at 0.5% (variable rate) / 2% (fixed rate).",
  },
};

/** Country-aware system prompt that points the model at the pre-computed facts. */
function buildSystem(ctx: CoachContext, locale?: string): string {
  const cc = ctx.countryName;
  const isPT = ctx.country === "PT";
  const m = MARKET_RATES[ctx.country] ?? GENERIC_RATES;
  const market = `Typical financing rates in ${cc} (rough benchmarks as of ${RATES_AS_OF} — always tell the user to check live quotes): auto ${m.auto}, personal loan ${m.personal}, mortgage ${m.mortgage}, savings ${m.savings}.${m.note ? " " + m.note : ""}`;

  return `You are a warm, practical household financial coach for a ${ctx.currency} household in ${cc}.
Ground EVERY answer in the JSON snapshot provided — never invent numbers, and never redo arithmetic the snapshot already did.
The snapshot pre-computes the key figures; quote them verbatim rather than deriving your own:
- settingsIncome (monthly income), baseline (target cost of living), monthlySurplus (= settingsIncome − baseline), safeNewMonthlyCommitment, savingsRatePct, emergencyFundMonths, debtToIncomePct.
- debtProjections[] — per debt: aprPct, monthlyInstallment, scheduledPayoff, remainingInterest, and the effect of paying an extra €100/mo (overpay100MonthsSaved, overpay100InterestSaved).
- avalancheOrder (highest APR first, minimises interest) and snowballOrder (smallest balance first, quick wins).
- benchmark — national averages from Eurostat / national statistics, never other users.
If a needed number is not in the snapshot, say what you'd need instead of guessing. Income is take-home (net), so treat the 28/36 rule as a conservative guide.
Format money in ${ctx.currency}, use markdown, and cite the figures you used in parentheses, e.g. "(surplus €X, safe €Y)". Be concrete: ranges, not vague advice.

Guidance by topic:
- Housing / new recurring commitment: anchor on safeNewMonthlyCommitment and monthlySurplus; give a comfortable and a stretch range; flag thin savings when emergencyFundMonths < 3.
- Buying vs financing: compare paying from a named savings bucket (show remaining balance and emergency-fund impact) vs a loan (use the market rates below) vs leasing; show monthly and total interest.
- Existing debt / early repayment: rank using avalancheOrder or snowballOrder and quote the overpayment savings straight from debtProjections — do not recompute amortization. A lump sum usually beats saving when a debt's APR exceeds the savings rate below.${isPT ? " For Portuguese mortgages, mention the capped early-repayment fee (0.5% variable / 2% fixed)." : ""}
- Comparing loan / product offers: put them in a markdown table on a common footing (loans: Offer, APR, monthly, total interest, total cost, term; products: price, key specs, lifespan/contract, cost per year). Recommend the lowest total cost that still fits safeNewMonthlyCommitment; APR is the fair comparison metric, not the nominal rate.
- Savings goals: use each bucket's totalSaved and allocatedThisCycle to project when it is reachable.
- Benchmarks: compare to ${cc} averages via benchmark.incomePercentile, benchmark.savingsRatePct vs nationalSavingsRatePct, and benchmark.categories (flagged first). Attribute to ${cc} and note it is a public reference average; if benchmark is null, say so.

${market}

Guardrails: you are a budgeting coach, not a licensed financial, tax, or legal advisor. For regulated investments, tax wrappers, or legal specifics, give general context and recommend a qualified professional. Keep answers scannable: short intro, a table when comparing 2+ options, 2-4 bullets, one clear recommendation. 4-8 sentences for simple questions; longer only when a comparison genuinely needs it.${langInstruction(locale)}`;
}


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
      system: buildSystem(ctx, data.locale),
      temperature: 0.2,
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
      system: `${buildSystem(ctx, data.locale)}

Current household snapshot (JSON, always fresh):
${JSON.stringify(ctx)}

Answer the user's questions grounded in this snapshot. Use markdown when helpful. For quick questions stay short (2–5 sentences); for life-decision questions (housing, buying vs financing, taking on debt, big savings goals) give a more thorough answer with a range, an assumption line, and a clear recommendation.`,
      temperature: 0.2,
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
