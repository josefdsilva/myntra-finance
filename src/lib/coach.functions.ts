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
import { buildForecast, monthKey, type Plan } from "./plan";
import { estimateTextCredits, logHouseholdCredits } from "./credits.server";

const MODEL = "google/gemini-3-flash-preview";
const QUICK_MODEL = "google/gemini-2.5-flash-lite";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Routes short factual/UI questions to a cheaper model with no household
 * snapshot and no chat history. Deep advice questions still hit the full
 * context path so recommendations stay grounded in the household's numbers.
 */
function isQuickQuestion(msg: string): boolean {
  if (msg.length > 200) return false;
  const t = msg.trim().toLowerCase();
  // Common factual / UI / definition patterns across EN + a few PT/ES/FR/DE cues.
  return /^(what is|what's|whats|how do i|how can i|how to|where is|where do i|where can i|explain|define|tell me about|show me|can you show|is there|does bynku|what does|meaning of|o que é|o que e|como faço|como posso|onde|qué es|que es|cómo|como|où|comment|was ist|wie)\b/.test(
    t,
  );
}

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
  initial_balance: number | string;
  kind: "savings" | "emergency" | "investment" | null;
};
type AllocRow = { bucket_id: string; amount: number | string; confirmed_at: string };
type AllAllocRow = { bucket_id: string; amount: number | string };
type BucketMoveRow = {
  amount: number | string;
  to_type: string | null;
  to_id: string | null;
  from_type: string | null;
  from_id: string | null;
  created_at: string | null;
  reason: string | null;
};

type CoachContext = {
  today: string;
  currency: string;
  baseline: number;
  /** Next 6 months folding in known plans: income, baseline, plannedSpend, leftover, shortfall. */
  planForecast: Array<{
    month: string;
    income: number;
    baseline: number;
    plannedSpend: number;
    leftover: number;
    shortfall: boolean;
  }>;
  /** Known future costs / income changes the household entered. */
  upcomingPlans: Array<{
    label: string;
    month: string;
    amount: number;
    direction: string;
    recurrence: string;
    funded: boolean;
  }>;
  /** Recently paid plans, estimate vs actual. */
  resolvedPlansRecent: Array<{
    label: string;
    month: string;
    planned: number;
    actual: number;
    direction: string;
  }>;
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
  /** Each income source with its plain type (salary, rent, pension, benefits, other). */
  incomeSources: Array<{ label: string; type: string; monthly_amount: number }>;
  /** Settings income − baseline (baseline includes fixed + debt + variable + margin). */
  monthlySurplus: number;
  /** Conservative safe monthly payment for a new recurring commitment (rent, loan, lease). */
  safeNewMonthlyCommitment: number;
  /** Real balance across ALL projects (initial + allocations + net movements). */
  totalSavings: number;
  /** Real balance of emergency-tagged projects. */
  emergencyBalance: number;
  /** Real balance of investment-tagged projects — do not treat as spare liquidity. */
  investmentBalance: number;
  /** Real balance of ordinary savings-goal projects. */
  savingsBalance: number;
  /** Liquid safety reserve (emergency projects if any, else all non-investment savings). */
  liquidReserve: number;
  /** True if the household has at least one project tagged as its emergency fund. */
  hasEmergencyBucket: boolean;
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
    kind: "savings" | "emergency" | "investment";
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
  /** liquidReserve / essentialsMonthly, in months (excludes investments). Null if no expenses. */
  emergencyFundMonths: number | null;
  /** Realized savings rate: avg real allocations ÷ avg income per cycle, %. Null if no income history. */
  savingsRatePct: number | null;
  /** Potential savings rate: monthlySurplus ÷ income, % — the capacity, not what was saved. */
  potentialSavingsRatePct: number | null;
  /** Avg income per cycle (actual income events) over the trailing window. */
  avgIncomePerCycle: number;
  /** Avg real allocations per cycle (confirmations + net movements) over the window. */
  avgRealAllocPerCycle: number;
  /** Number of complete months of income history the realized rate is based on. */
  savingsRateCycles: number;
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
    { data: bucketMoves },
    { data: plansData },
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
      .select("id, name, target_type, target_value, target_deadline, initial_balance, kind")
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
    // All-time movements touching buckets, so bucket balances fold in
    // deposits, withdrawals and transfers — not just confirmed allocations.
    supabase
      .from("account_movements")
      .select("amount, to_type, to_id, from_type, from_id, created_at, reason")
      .eq("household_id", householdId)
      .or("to_type.eq.bucket,from_type.eq.bucket"),
    supabase
      .from("plans")
      .select("id, label, amount, actual_amount, direction, month, recurrence, category, bucket_id, done")
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
    .select("label, type, monthly_amount")
    .eq("household_id", householdId);
  const settingsIncome = sumMonthly(incomesRows);
  const incomeSources = rowsOrEmpty<{ label: string; type: string; monthly_amount: number | string }>(
    incomesRows,
  ).map((r) => ({ label: r.label, type: r.type, monthly_amount: Number(r.monthly_amount) || 0 }));
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
  // A bucket's real balance = seeded initial_balance + all-time confirmed
  // allocations + net movements (deposits/transfers in − withdrawals/payments
  // out). This matches the balance the app shows and the amount the user has
  // truly set aside — so the coach no longer undercounts pre-funded projects.
  const totalByBucket: Record<string, number> = {};
  for (const b of rowsOrEmpty<BucketRow>(buckets)) {
    totalByBucket[b.id] = Number(b.initial_balance ?? 0);
  }
  for (const a of rowsOrEmpty<AllAllocRow>(allAllocs)) {
    totalByBucket[a.bucket_id] = (totalByBucket[a.bucket_id] ?? 0) + Number(a.amount);
  }
  for (const m of rowsOrEmpty<BucketMoveRow>(bucketMoves)) {
    const amt = Number(m.amount) || 0;
    if (m.to_type === "bucket" && m.to_id)
      totalByBucket[m.to_id] = (totalByBucket[m.to_id] ?? 0) + amt;
    if (m.from_type === "bucket" && m.from_id)
      totalByBucket[m.from_id] = (totalByBucket[m.from_id] ?? 0) - amt;
  }
  const totalSavings = Object.values(totalByBucket).reduce((s, v) => s + v, 0);

  // Split balances by project type so the coach can honour the emergency-fund-
  // first, then-invest priority and never treat investments as spare liquidity.
  const kindOf: Record<string, "savings" | "emergency" | "investment"> = {};
  let hasEmergencyBucket = false;
  for (const b of rowsOrEmpty<BucketRow>(buckets)) {
    const k = b.kind ?? "savings";
    kindOf[b.id] = k;
    if (k === "emergency") hasEmergencyBucket = true;
  }
  let emergencyBalance = 0,
    investmentBalance = 0,
    savingsBalance = 0;
  for (const [id, bal] of Object.entries(totalByBucket)) {
    const k = kindOf[id] ?? "savings";
    if (k === "emergency") emergencyBalance += bal;
    else if (k === "investment") investmentBalance += bal;
    else savingsBalance += bal;
  }
  emergencyBalance = Math.round(emergencyBalance * 100) / 100;
  investmentBalance = Math.round(investmentBalance * 100) / 100;
  savingsBalance = Math.round(savingsBalance * 100) / 100;
  // Liquid safety reserve = money the household can reach without selling
  // investments: the emergency-tagged projects if any exist, otherwise all
  // non-investment savings. Investments are deliberately excluded.
  const liquidReserve = hasEmergencyBucket ? emergencyBalance : savingsBalance + emergencyBalance;

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
    essentialsMonthly > 0 ? Math.round((liquidReserve / essentialsMonthly) * 10) / 10 : null;
  // Realized savings rate: what you actually set aside vs. what you actually
  // earned, averaged over recent complete months. Real allocations = confirmed
  // allocations + net bucket movements. Income = actual income events recorded.
  // Falls back to null when there isn't a complete month of income history yet.
  const RATE_WINDOW_MONTHS = 6;
  const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const windowStart = new Date(now.getFullYear(), now.getMonth() - RATE_WINDOW_MONTHS, 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const windowStartPeriod = `${windowStart.getFullYear()}-${pad(windowStart.getMonth() + 1)}-01`;
  const curPeriod = `${curMonthStart.getFullYear()}-${pad(curMonthStart.getMonth() + 1)}-01`;

  const [{ data: histAllocRows }, { data: histIncomeRows }] = await Promise.all([
    supabase
      .from("bucket_allocations")
      .select("amount, period")
      .eq("household_id", householdId)
      .gte("period", windowStartPeriod)
      .lt("period", curPeriod),
    supabase
      .from("expenses")
      .select("amount, occurred_at")
      .eq("household_id", householdId)
      .eq("kind", "income")
      .gte("occurred_at", windowStart.toISOString())
      .lt("occurred_at", curMonthStart.toISOString()),
  ]);

  let realAllocWindow = 0;
  for (const a of rowsOrEmpty<{ amount: number | string }>(histAllocRows)) {
    realAllocWindow += Number(a.amount) || 0;
  }
  const winStartISO = windowStart.toISOString();
  const curMonthISO = curMonthStart.toISOString();
  for (const m of rowsOrEmpty<BucketMoveRow>(bucketMoves)) {
    if (!m.created_at || m.created_at < winStartISO || m.created_at >= curMonthISO) continue;
    if (m.reason === "plan_payment") continue; // spending a plan from a project isn't dis-saving
    const amt = Number(m.amount) || 0;
    if (m.to_type === "bucket") realAllocWindow += amt;
    if (m.from_type === "bucket") realAllocWindow -= amt;
  }

  let incomeWindow = 0;
  const incomeMonths = new Set<string>();
  for (const e of rowsOrEmpty<{ amount: number | string; occurred_at: string }>(histIncomeRows)) {
    incomeWindow += Number(e.amount) || 0;
    const d = new Date(e.occurred_at);
    incomeMonths.add(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  }
  const savingsRateCycles = incomeMonths.size;
  const avgIncomePerCycle =
    savingsRateCycles > 0 ? Math.round((incomeWindow / savingsRateCycles) * 100) / 100 : 0;
  const avgRealAllocPerCycle =
    savingsRateCycles > 0 ? Math.round((realAllocWindow / savingsRateCycles) * 100) / 100 : 0;
  // Headline rate = realized (actual money set aside ÷ actual income).
  const savingsRatePct =
    incomeWindow > 0 ? Math.round((realAllocWindow / incomeWindow) * 1000) / 10 : null;
  // Potential rate = capacity (surplus ÷ income) — for the coach to contrast with
  // the realized rate and nudge toward saving/investing more of the headroom.
  const potentialSavingsRatePct =
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

  // ---- Forward plans (future costs & income changes the household entered) ----
  const planList = rowsOrEmpty<Plan>(plansData as Plan[] | null);
  const planForecast = buildForecast({
    plans: planList,
    baseline,
    monthlyIncome: settingsIncome,
    months: 6,
  }).map((m) => ({
    month: m.ym,
    income: m.income,
    baseline: m.baseline,
    plannedSpend: m.plannedSpend,
    leftover: m.leftover,
    shortfall: m.shortfall,
  }));
  const nowYm = monthKey(new Date());
  const upcomingPlans = planList
    .filter((p) => !p.done && String(p.month).slice(0, 7) >= nowYm)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)))
    .slice(0, 12)
    .map((p) => ({
      label: p.label,
      month: String(p.month).slice(0, 7),
      amount: Math.abs(Number(p.amount) || 0),
      direction: p.direction,
      recurrence: p.recurrence,
      funded: !!p.bucket_id,
    }));
  const resolvedPlansRecent = planList
    .filter((p) => p.done)
    .sort((a, b) => String(b.month).localeCompare(String(a.month)))
    .slice(0, 6)
    .map((p) => ({
      label: p.label,
      month: String(p.month).slice(0, 7),
      planned: Math.abs(Number(p.amount) || 0),
      actual: Number(p.actual_amount ?? 0),
      direction: p.direction,
    }));

  return {
    today: new Date().toISOString(),
    currency: hh?.currency ?? "EUR",
    baseline,
    planForecast,
    upcomingPlans,
    resolvedPlansRecent,
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
    incomeSources,
    monthlySurplus,
    safeNewMonthlyCommitment,
    totalSavings,
    emergencyBalance,
    investmentBalance,
    savingsBalance,
    liquidReserve,
    hasEmergencyBucket,
    cycleTotals: { spent, received, net: spent - received, byCategory },
    previousCycleTotals,
    buckets: rowsOrEmpty<BucketRow>(buckets).map((b) => ({
      name: b.name,
      kind: (b.kind ?? "savings") as "savings" | "emergency" | "investment",
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
    potentialSavingsRatePct,
    avgIncomePerCycle,
    avgRealAllocPerCycle,
    savingsRateCycles,
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

/**
 * The copy of the snapshot actually sent to the model. Caps the long arrays to
 * cut input tokens without dropping any field the prompt relies on. Every screen
 * still gets the full ctx; only what the model sees is trimmed.
 */
function slimContext(ctx: CoachContext): CoachContext {
  return {
    ...ctx,
    topSpends: ctx.topSpends.slice(0, 6),
    upcomingPlans: ctx.upcomingPlans.slice(0, 8),
    resolvedPlansRecent: ctx.resolvedPlansRecent.slice(0, 4),
  };
}

/** Country-aware system prompt that points the model at the pre-computed facts. */
function buildSystem(ctx: CoachContext, locale?: string): string {
  const cc = ctx.countryName;
  const isPT = ctx.country === "PT";
  const m = MARKET_RATES[ctx.country] ?? GENERIC_RATES;
  const market = `Typical financing rates in ${cc} (rough benchmarks as of ${RATES_AS_OF} — always tell the user to check live quotes): auto ${m.auto}, personal loan ${m.personal}, mortgage ${m.mortgage}, savings ${m.savings}.${m.note ? " " + m.note : ""}`;

  return `You are a warm, practical household financial coach for a ${ctx.currency} household in ${cc}.
Ground EVERY answer in the JSON snapshot provided — never invent numbers, and never redo arithmetic the snapshot already did.
The snapshot pre-computes the key figures; quote them verbatim rather than deriving your own:
- settingsIncome (monthly income), baseline (target cost of living), monthlySurplus (= settingsIncome − baseline), safeNewMonthlyCommitment, emergencyFundMonths, debtToIncomePct.
- incomeSources[] lists each income with its type (salary, rent, pension, benefits, other). Use it to judge how stable and diversified the income is: a single salary is more fragile than a pension or benefits, and if most income is one source, note the concentration gently. Rent income implies an owned property.
- savingsRatePct is the REALIZED savings rate: what the household actually set aside vs. what it actually earned (avgRealAllocPerCycle ÷ avgIncomePerCycle over savingsRateCycles complete months). This is the headline rate — quote it as the savings rate. If savingsRatePct is null, there isn't a full month of income history yet; say so and lean on potentialSavingsRatePct instead of inventing a rate.
- potentialSavingsRatePct is the household's CAPACITY to save (monthlySurplus ÷ income). Use it to contrast with the realized rate: when potential exceeds realized, encourage saving/investing more of the headroom; when they are close, acknowledge they're already converting most of their surplus. emergencyFundMonths already counts pre-funded project balances, so trust it.
- Projects are typed: each buckets[] item has kind ∈ savings | emergency | investment. Balances are split into emergencyBalance, savingsBalance and investmentBalance; liquidReserve is the safety cushion (emergency projects if hasEmergencyBucket, else all non-investment savings) and is what emergencyFundMonths measures — investments are excluded on purpose because they shouldn't be raided.
- debtProjections[] — per debt: aprPct, monthlyInstallment, scheduledPayoff, remainingInterest, and the effect of paying an extra €100/mo (overpay100MonthsSaved, overpay100InterestSaved).
- avalancheOrder (highest APR first, minimises interest) and snowballOrder (smallest balance first, quick wins).
- benchmark — national averages from Eurostat / national statistics, never other users.
- upcomingPlans[] — known future costs and income changes the household entered (label, month, amount, direction spend|income, recurrence, funded=whether a project is saving for it). planForecast[] projects the next 6 months: income, baseline, plannedSpend, leftover, and shortfall (that month runs short). resolvedPlansRecent[] shows recently paid plans with planned vs actual. Use these for ANY question about the months ahead, saving for something specific, or what to do with money the household did not expect: point to the real upcoming claims on their money, flag any shortfall month, and suggest pre-funding a big unfunded one-off as a project. When advising on a windfall, first cover imminent unfunded plans and any shortfall month, then the emergency-fund gap, then debt and investing.
If a needed number is not in the snapshot, say what you'd need instead of guessing. Income is take-home (net), so treat the 28/36 rule as a conservative guide.
Format money in ${ctx.currency}, use markdown, and cite the figures you used in parentheses, e.g. "(surplus €X, safe €Y)". Be concrete: ranges, not vague advice.

Guidance by topic:
- Housing / new recurring commitment: anchor on safeNewMonthlyCommitment and monthlySurplus; give a comfortable and a stretch range; flag thin savings when emergencyFundMonths < 3.
- Buying vs financing: compare paying from a named savings bucket (show remaining balance and emergency-fund impact) vs a loan (use the market rates below) vs leasing; show monthly and total interest.
- Existing debt / early repayment: rank using avalancheOrder or snowballOrder and quote the overpayment savings straight from debtProjections — do not recompute amortization. A lump sum usually beats saving when a debt's APR exceeds the savings rate below.${isPT ? " For Portuguese mortgages, mention the capped early-repayment fee (0.5% variable / 2% fixed)." : ""}
- Comparing loan / product offers: put them in a markdown table on a common footing (loans: Offer, APR, monthly, total interest, total cost, term; products: price, key specs, lifespan/contract, cost per year). Recommend the lowest total cost that still fits safeNewMonthlyCommitment; APR is the fair comparison metric, not the nominal rate.
- Savings goals: use each bucket's totalSaved and allocatedThisCycle to project when it is reachable.
- Saving vs investing vs debt (use whenever the user asks what to do with spare money, a windfall, or how to set up projects): there is no single answer — weigh the household's situation. Rough priority: (1) build the emergency fund toward a healthy cushion — for this household ${ctx.emergencyFundMonths == null ? "coverage is unknown" : `it currently covers ${ctx.emergencyFundMonths} months`}, and a thin reserve (roughly under 3 months of essentials) takes priority over new investing; (2) clear high-APR debt — money guaranteed-earns the debt's APR by paying it down, which usually beats investing when the APR exceeds expected after-tax investment returns (see market savings/loan rates); (3) once the cushion is adequate and expensive debt is gone, invest the surplus for long-term growth. Then judge the specific case: if emergencyFundMonths is comfortable and investmentBalance/allocations look light relative to their surplus and savingsRatePct, they are likely UNDER-investing — encourage putting idle surplus to work. If they are investing while the emergency fund is thin or high-APR debt is outstanding, they may be OVER-investing — gently suggest rebalancing toward the reserve or the debt first. Never recommend pulling money OUT of investments (investmentBalance) unless it is truly necessary — e.g. no other way to cover an emergency or stop punishing high-interest debt; say so explicitly when you do. Frame all of this as trade-offs, cite the figures, and recommend a professional for regulated investment products.
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
      prompt: `Household snapshot (JSON):\n${JSON.stringify(slimContext(ctx))}\n\n${OVERVIEW_PROMPT}`,
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
${JSON.stringify(slimContext(ctx))}

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

// ==========================================================================
// Persistent coach conversations. We keep at most 5 per household (DB trigger)
// and replay only the last REPLAY_TURNS turns to bound token cost.
// ==========================================================================

/** How many prior turns (user+assistant pairs) are replayed to the model. */
export const COACH_REPLAY_TURNS = 3;

export const listCoachConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ householdId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHouseholdMember(supabase, data.householdId, userId);
    const { data: rows } = await supabase
      .from("coach_conversations")
      .select("id, title, created_at, updated_at")
      .eq("household_id", data.householdId)
      .order("updated_at", { ascending: false })
      .limit(5);
    return rows ?? [];
  });

export const getCoachConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ conversationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: conv } = await supabase
      .from("coach_conversations")
      .select("id, household_id, title, created_at, updated_at")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv) throw new Error("Conversation not found");
    await assertHouseholdMember(supabase, conv.household_id as string, userId);
    const { data: msgs } = await supabase
      .from("coach_messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    return { conversation: conv, messages: msgs ?? [] };
  });

export const createCoachConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ householdId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHouseholdMember(supabase, data.householdId, userId);
    const { data: row, error } = await supabase
      .from("coach_conversations")
      .insert({ household_id: data.householdId, created_by: userId })
      .select("id, title, created_at, updated_at")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteCoachConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ conversationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: conv } = await supabase
      .from("coach_conversations")
      .select("household_id")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv) return { ok: true };
    await assertHouseholdMember(supabase, conv.household_id as string, userId);
    await supabase.from("coach_conversations").delete().eq("id", data.conversationId);
    return { ok: true };
  });

/**
 * Persistent chat: appends the user turn, calls the model with only the last
 * COACH_REPLAY_TURNS turns of context, appends the assistant reply, and bumps
 * updated_at. If conversationId is null a new conversation is created.
 */
export const chatInConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        householdId: z.string().uuid(),
        conversationId: z.string().uuid().nullable().optional(),
        message: z.string().min(1).max(2000),
        locale: z.string().optional(),
        forceDeep: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHouseholdMember(supabase, data.householdId, userId);

    // Resolve / create the conversation.
    let convId = data.conversationId ?? null;
    if (convId) {
      const { data: existing } = await supabase
        .from("coach_conversations")
        .select("id, household_id")
        .eq("id", convId)
        .maybeSingle();
      if (!existing || existing.household_id !== data.householdId) {
        throw new Error("Conversation not found");
      }
    } else {
      const { data: row, error } = await supabase
        .from("coach_conversations")
        .insert({ household_id: data.householdId, created_by: userId })
        .select("id")
        .single();
      if (error) throw error;
      convId = row.id as string;
    }

    // Load prior messages (all — we render them all client-side, but only replay tail).
    const { data: priorRows } = await supabase
      .from("coach_messages")
      .select("role, content, created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    const prior = (priorRows ?? []) as Array<{ role: "user" | "assistant"; content: string }>;

    // Replay only the last N turns (user+assistant pairs => N*2 messages).
    const replayCount = COACH_REPLAY_TURNS * 2;
    const replayed = prior.slice(-replayCount);

    // Persist the incoming user message before calling the model.
    await supabase.from("coach_messages").insert({
      conversation_id: convId,
      household_id: data.householdId,
      role: "user",
      content: data.message,
    });

    const useQuick = !data.forceDeep && isQuickQuestion(data.message);
    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
    const modelId = useQuick ? QUICK_MODEL : MODEL;

    let systemPrompt: string;
    let messages: Array<{ role: "user" | "assistant"; content: string }>;
    if (useQuick) {
      // Quick tier: no household snapshot, no chat history. Great for factual
      // or "how do I…" questions about the app or general finance concepts.
      systemPrompt = `You are bynku's household finance coach. This is a QUICK reply — the user asked a short factual or how-to question, so no household numbers are provided. Answer plainly in 2–4 sentences. If the question actually needs the household's own figures to answer well, say so and invite them to toggle "Deep think" for a numbers-grounded answer.${langInstruction(data.locale)}`;
      messages = [{ role: "user" as const, content: data.message }];
    } else {
      const ctx = await buildContext(supabase, data.householdId);
      systemPrompt = `${buildSystem(ctx, data.locale)}

Current household snapshot (JSON, always fresh):
${JSON.stringify(slimContext(ctx))}

You are continuing an ongoing chat with this household. Only the last ${COACH_REPLAY_TURNS} turns of the conversation are provided; older turns exist but are not replayed to save tokens — do not claim to remember details from earlier in the chat unless they appear in the replayed history or the snapshot above. Answer grounded in the snapshot. For quick questions stay short (2–5 sentences); for life-decision questions give a thorough answer with a range, assumption line, and clear recommendation.`;
      messages = [
        ...replayed.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: data.message },
      ];
    }

    const result = await generateText({
      model: gateway(modelId),
      system: systemPrompt,
      temperature: 0.2,
      messages,
    });

    await supabase.from("coach_messages").insert({
      conversation_id: convId,
      household_id: data.householdId,
      role: "assistant",
      content: result.text,
    });

    // Auto-title from the first user message if the conversation has no title yet.
    const updates: { updated_at: string; title?: string } = {
      updated_at: new Date().toISOString(),
    };
    if (prior.length === 0) {
      updates.title = data.message.slice(0, 60);
    }
    await supabase.from("coach_conversations").update(updates).eq("id", convId);

    const est = estimateTextCredits(modelId, result.usage as never);
    await logHouseholdCredits({
      householdId: data.householdId,
      userId,
      operation: useQuick ? "ai_coach_chat_quick" : "ai_coach_chat",
      credits: est.credits,
      inputTokens: est.input,
      outputTokens: est.output,
    });

    return { reply: result.text, conversationId: convId, tier: useQuick ? "quick" : "deep" };
  });

