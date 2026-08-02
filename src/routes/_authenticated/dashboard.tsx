import { pageMeta } from "@/lib/route-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { money, fmtDateTime, fmtDate } from "@/lib/format";
import { SetupChecklist } from "@/components/setup-checklist";
import { fetchCycleBounds, cycleKeyPart } from "@/lib/cycle-bounds";
import { leftoverObligation, monthKey, plansInWindow, type Plan } from "@/lib/plan";
import {
  bucketsQuery,
  incomesQuery,
  fixedExpensesQuery,
  debtsQuery,
} from "@/lib/household-queries";
import { ExpenseQuickAdd } from "@/components/expense-quick-add";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { markIncomeReceived } from "@/lib/budget.functions";
import { toast } from "sonner";
import {
  Wallet,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  CalendarClock,
  X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DashboardTips } from "@/components/dashboard-tips";
import { MomentumCard } from "@/components/score-trend";
import { PurchaseCheckButton } from "@/components/purchase-check";
import { GoalsCard } from "@/components/goals-card";
import { pageShellClass } from "@/components/page-shell";
import { NetWorthCard } from "@/components/net-worth-card";
import { IncomeAllocationSuggestion } from "@/components/income-allocation-suggestion";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () =>
    pageMeta({
      path: "/dashboard",
      title: "Dashboard · bynku",
      description:
        "Your daily safe-to-spend, spending trend and personalised issues and tips at a glance.",
      noindex: true,
    }),
  component: Dashboard,
});

function Dashboard() {
  const t = useT();
  const dashboardQc = useQueryClient();
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHousehold = useServerFn(getOrCreateHousehold);
  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () =>
      fetchHousehold({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
  });

  const householdId = hh?.household?.id;

  const {
    data: dashboard,
    refetch,
    isLoading: dashboardLoading,
  } = useQuery({
    enabled: !!householdId,
    queryKey: ["dashboard", householdId, ...cycleKeyPart(hh?.household)],
    queryFn: async () => {
      // Cycle bounds and the base reference tables are independent — resolve them
      // in parallel. Only the cycle-scoped expenses query needs the bounds first.
      const [cycle, fixed, debts, incomes, buckets] = await Promise.all([
        fetchCycleBounds(supabase, householdId!, hh?.household),
        dashboardQc.fetchQuery(fixedExpensesQuery(householdId!)),
        dashboardQc.fetchQuery(debtsQuery(householdId!)),
        dashboardQc.fetchQuery(incomesQuery(householdId!)),
        dashboardQc.fetchQuery(bucketsQuery(householdId!)),
      ]);
      const { data: expenses } = await supabase
        .from("expenses")
        .select("id, amount, category, merchant, occurred_at, note, source, kind, is_salary")
        .eq("household_id", householdId!)
        .gte("occurred_at", cycle.start.toISOString())
        .lt("occurred_at", cycle.end.toISOString())
        .order("occurred_at", { ascending: false });
      const fixedTotal =
        fixed.reduce((s, r) => s + Number(r.monthly_amount), 0) +
        debts.reduce((s, r) => s + Number(r.monthly_amount), 0);
      const spent = (expenses ?? [])
        .filter((r) => r.kind !== "income")
        .reduce((s, r) => s + Number(r.amount), 0);
      // Exclude salary deposits from "received" — they're the income, not a top-up
      const received = (expenses ?? [])
        .filter((r) => r.kind === "income" && !r.is_salary)
        .reduce((s, r) => s + Number(r.amount), 0);
      const income = incomes.reduce((s, r) => s + Number(r.monthly_amount), 0);
      return {
        cycle,
        fixedTotal,
        spent,
        received,
        income,
        buckets,
        recent: (expenses ?? []).slice(0, 10),
        expenses: expenses ?? [],
        totalExpenses: expenses?.length ?? 0,
      };
    },
  });

  // Real allocations this cycle = confirmed bucket allocations for this period
  // + net account movements into buckets. Used so the dashboard reflects what
  // was actually set aside, not the planned target.
  const { data: realAlloc } = useQuery({
    enabled: !!householdId,
    queryKey: ["dashboard-real-alloc", householdId, ...cycleKeyPart(hh?.household)],
    queryFn: async () => {
      // Scope to the payday cycle, not the calendar month — a cycle can straddle
      // two months, so counting only "this month" understates what was set aside.
      const bounds = await fetchCycleBounds(supabase, householdId!, hh?.household);
      const period = `${bounds.start.getFullYear()}-${String(
        bounds.start.getMonth() + 1,
      ).padStart(2, "0")}-01`;
      const [{ data: confs }, { data: moves }] = await Promise.all([
        supabase
          .from("bucket_allocations")
          .select("amount")
          .eq("household_id", householdId!)
          .eq("period", period),
        supabase
          .from("account_movements")
          .select("amount, to_type, from_type, reason")
          .eq("household_id", householdId!)
          .gte("created_at", bounds.start.toISOString())
          .lt("created_at", bounds.end.toISOString())
          .or("to_type.eq.bucket,from_type.eq.bucket"),
      ]);
      const confirmed = (confs ?? []).reduce((s, c) => s + Number(c.amount), 0);
      const movementsNet = (moves ?? []).reduce((s, m) => {
        // A plan paid out of a project isn't a change in what's set aside.
        if (m.reason === "plan_payment") return s;
        let d = 0;
        if (m.to_type === "bucket") d += Number(m.amount);
        if (m.from_type === "bucket") d -= Number(m.amount);
        return s + d;
      }, 0);
      return confirmed + movementsNet;
    },
  });

  // Unfunded planned spend landing in the current cycle — subtracted from the
  // real surplus so the dashboard reflects money already spoken for by plans.
  const { data: plannedThisCycle } = useQuery({
    enabled: !!householdId,
    queryKey: ["dashboard-planned", householdId],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("plans")
        .select(
          "id, label, amount, actual_amount, direction, month, recurrence, category, bucket_id, done, expense_id",
        )
        .eq("household_id", householdId!);
      return leftoverObligation((rows ?? []) as unknown as Plan[], monthKey(new Date()));
    },
  });

  // Plans still open and landing in the current cycle — powers the "new cycle,
  // here's what's coming" nudge shown just after a cycle rolls over.
  const { data: upcomingPlans } = useQuery({
    enabled: !!householdId,
    queryKey: ["dashboard-upcoming-plans", householdId, ...cycleKeyPart(hh?.household)],
    queryFn: async () => {
      const [{ data }, bounds] = await Promise.all([
        supabase.from("plans").select("*").eq("household_id", householdId!),
        fetchCycleBounds(supabase, householdId!, hh?.household),
      ]);
      return plansInWindow((data ?? []) as Plan[], bounds.start, bounds.end);
    },
  });
  const [plansNudgeDismissed, setPlansNudgeDismissed] = useState(false);

  const [expenseFilter, setExpenseFilter] = useState<"all" | "spent" | "received">("all");

  const baseline = Number(hh?.household?.baseline_budget ?? 0);
  const income = dashboard?.income ?? 0;
  const surplus = Math.max(0, income - baseline);
  const realAllocated = realAlloc ?? 0;

  // Plans claim the unallocated leftover surplus first; whatever they can't cover
  // surfaces as pressure on "Available" and the real-surplus stat below. It no
  // longer silently zeroes the everyday allowance — that was double-counting once
  // "Available" began carrying project/plan pressure explicitly, and it produced
  // a €0 daily number even when the everyday pool clearly had room.
  const leftover0 = Math.max(0, surplus - realAllocated);
  const obligation = plannedThisCycle ?? 0;
  const realSurplus = leftover0 - Math.min(obligation, leftover0);

  const variablePool = Math.max(0, baseline - (dashboard?.fixedTotal ?? 0));
  const spent = dashboard?.spent ?? 0;
  const received = dashboard?.received ?? 0;
  const netSpent = Math.max(0, spent - received);
  // "Available" = genuinely free cash left this cycle, income-anchored: income
  // minus fixed+debt (fixedTotal already bundles debt), minus what's already set
  // aside to projects, minus everyday spend so far.
  const available = income - (dashboard?.fixedTotal ?? 0) - realAllocated - netSpent;
  // Everyday allowance is the baseline variable budget minus everyday spend — but
  // it can never exceed the free cash actually available. If project funding has
  // pushed Available below the everyday budget, spending the whole budget would
  // dip into projects, so safe-to-spend is capped at Available.
  const everydayLeft = Math.max(0, variablePool - netSpent);
  const remaining = Math.max(0, Math.min(everydayLeft, available));
  const overspent = netSpent > variablePool;
  const cycle = dashboard?.cycle;
  const daysLeft = cycle?.daysLeft ?? 1;
  // A cycle "just rolled over" in its first few days. Pair that with any open
  // plans landing this cycle to nudge the user before the money is spent.
  const daysSinceCycleStart = cycle?.start
    ? Math.floor((Date.now() - new Date(cycle.start).getTime()) / 86400000)
    : 999;
  const upcomingPlanCount = upcomingPlans?.length ?? 0;
  const showPlansNudge = !plansNudgeDismissed && daysSinceCycleStart <= 3 && upcomingPlanCount > 0;
  const safeToday = variablePool > 0 ? remaining / daysLeft : 0;
  // Show the safe amount over a chosen horizon: today (1 day), the next 7 days,
  // or the rest of the cycle (= everything remaining). "Next 7 days" is only
  // offered when more than a week remains, else it duplicates "rest of cycle".
  const showWeek = daysLeft > 7;
  // Default to a forward-looking window rather than just today: "Next 7 days"
  // when there is more than a week left, otherwise "Rest of cycle". Stays null
  // until the user taps a tab, so the default follows the cycle data as it loads.
  const [horizonChoice, setHorizon] = useState<"today" | "week" | "cycle" | null>(null);
  const horizon = horizonChoice ?? (showWeek ? "week" : "cycle");
  const effHorizon = horizon === "week" && !showWeek ? "cycle" : horizon;
  const horizonDays = effHorizon === "today" ? 1 : effHorizon === "week" ? 7 : daysLeft;
  const safeForHorizon = safeToday * horizonDays;
  const safeLabelKey =
    effHorizon === "today"
      ? "dashboard.safe.labelToday"
      : effHorizon === "week"
        ? "dashboard.safe.labelWeek"
        : "dashboard.safe.labelCycle";
  const pctSpent = variablePool > 0 ? Math.min(100, (netSpent / variablePool) * 100) : 0;

  const overspendAmount = Math.max(0, netSpent - variablePool);
  const buckets = dashboard?.buckets ?? [];

  // Trend: compare with yesterday's safe-to-spend (spent through end of yesterday, days-left as of yesterday)
  const allExpenses = useMemo(() => dashboard?.expenses ?? [], [dashboard?.expenses]);
  const yesterdayEnd = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const netSpentThroughYesterday = useMemo(() => {
    const s = allExpenses
      .filter((r) => r.kind !== "income" && new Date(r.occurred_at) < yesterdayEnd)
      .reduce((s, r) => s + Number(r.amount), 0);
    const rc = allExpenses
      .filter((r) => r.kind === "income" && !r.is_salary && new Date(r.occurred_at) < yesterdayEnd)
      .reduce((s, r) => s + Number(r.amount), 0);
    return Math.max(0, s - rc);
  }, [allExpenses, yesterdayEnd]);
  const daysLeftYesterday = Math.max(1, daysLeft + 1);
  const safeYesterday =
    variablePool > 0 ? Math.max(0, variablePool - netSpentThroughYesterday) / daysLeftYesterday : 0;
  const trendDelta = safeToday - safeYesterday;

  // Sparkline of daily net spend. The window matches the selected horizon so
  // the comparison is like-for-like: "today" = today only (vs previous day for
  // context), "week" = last 7 days, "cycle" = the last `daysLeft` days. We
  // fetch enough history for the widest view (rest of cycle), then slice below.
  const sparkWindowDays = Math.min(90, Math.max(7, daysLeft));
  const { data: sparkRows } = useQuery({
    enabled: !!householdId,
    queryKey: ["dashboard-spark", householdId, sparkWindowDays],
    queryFn: async () => {
      const now = new Date();
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - (sparkWindowDays - 1),
      );
      const { data } = await supabase
        .from("expenses")
        .select("amount, occurred_at, kind, is_salary")
        .eq("household_id", householdId!)
        .gte("occurred_at", start.toISOString());
      return data ?? [];
    },
  });
  const sparkAll = useMemo(() => {
    const rows = sparkRows ?? [];
    const days: { key: string; label: string; net: number }[] = [];
    const now = new Date();
    for (let i = sparkWindowDays - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const spent = rows
        .filter(
          (r) =>
            r.kind !== "income" && new Date(r.occurred_at) >= d && new Date(r.occurred_at) < next,
        )
        .reduce((s, r) => s + Number(r.amount), 0);
      const rc = rows
        .filter(
          (r) =>
            r.kind === "income" &&
            !r.is_salary &&
            new Date(r.occurred_at) >= d &&
            new Date(r.occurred_at) < next,
        )
        .reduce((s, r) => s + Number(r.amount), 0);
      days.push({
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString("en-GB", { weekday: "short" }),
        net: Math.max(0, spent - rc),
      });
    }
    return days;
  }, [sparkRows, sparkWindowDays]);
  // Slice to the selected horizon. "today" is a single point, which reads as a
  // dot on the line — pair it with yesterday so the user still sees a trend.
  const sparkSliceDays = effHorizon === "today" ? 2 : effHorizon === "week" ? 7 : daysLeft;
  const spark = useMemo(
    () => sparkAll.slice(Math.max(0, sparkAll.length - sparkSliceDays)),
    [sparkAll, sparkSliceDays],
  );
  const sparkMax = Math.max(safeToday, ...spark.map((d) => d.net), 1);
  const avgDaily7 =
    sparkAll.slice(-7).reduce((s, d) => s + d.net, 0) / Math.max(1, Math.min(7, sparkAll.length));
  const projectedBalance = remaining - avgDaily7 * daysLeft;

  function monthsUntil(dateStr: string | null): number {
    if (!dateStr) return 1;
    const t = new Date(dateStr);
    const n = new Date();
    const m =
      (t.getFullYear() - n.getFullYear()) * 12 +
      (t.getMonth() - n.getMonth()) +
      (t.getDate() >= n.getDate() ? 0 : -1) +
      1;
    return Math.max(1, m);
  }
  function bucketMonthly(b: (typeof buckets)[number]): number {
    const v = Number(b.target_value);
    if (b.target_type === "pct_surplus") return (surplus * v) / 100;
    if (b.target_type === "fixed_monthly") return v;
    if (b.target_type === "fixed_yearly") return v / 12;
    return v / monthsUntil(b.target_deadline);
  }
  const totalAllocated = buckets.reduce((s, b) => s + bucketMonthly(b), 0);
  const inJeopardy = overspendAmount > 0 && totalAllocated > 0;
  // Proportional impact: which buckets lose money
  const jeopardizedBuckets = inJeopardy
    ? buckets
        .map((b) => {
          const monthly = bucketMonthly(b);
          const share = totalAllocated > 0 ? monthly / totalAllocated : 0;
          return { name: b.name, color: b.color, loss: Math.min(monthly, overspendAmount * share) };
        })
        .filter((b) => b.loss > 0.01)
    : [];

  const monthName = useMemo(
    () => new Date().toLocaleString("en-GB", { month: "long", year: "numeric" }),
    [],
  );
  const cycleLabel = cycle
    ? cycle.source === "salary"
      ? t("dashboard.cycle.pay", { start: fmtDate(cycle.start), end: fmtDate(cycle.end) }) +
        (cycle.predicted ? t("dashboard.cycle.predicted") : "")
      : cycle.source === "time"
        ? t("dashboard.cycle.period", { start: fmtDate(cycle.start), end: fmtDate(cycle.end) })
        : t("dashboard.cycle.calendar", { month: monthName })
    : monthName;

  const isLoading = !hh || dashboardLoading || !dashboard;

  return (
    <div className={pageShellClass("5xl")}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{cycleLabel}</p>
          <h1 className="text-3xl md:text-4xl font-display">{t("dashboard.heading")}</h1>
        </div>
        {householdId && <PurchaseCheckButton isBusiness={hh?.household?.kind === "business"} />}
      </header>

      {!isLoading && householdId && (
        <SetupChecklist
          householdId={householdId}
          household={hh?.household ?? null}
          isBusiness={hh?.household?.kind === "business"}
        />
      )}

      {showPlansNudge && (
        <Card className="border-primary/25 bg-primary/5">
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="space-y-0.5">
                <p className="font-medium">{t("dashboard.plansNudge.title")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.plansNudge.body", { count: upcomingPlanCount })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button asChild size="sm">
                <Link to="/cashflow" search={{ lens: undefined }}>
                  {t("dashboard.plansNudge.action")}
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t("common.dismiss")}
                onClick={() => setPlansNudgeDismissed(true)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hero: safe to spend today */}
      <Card className="overflow-hidden">
        <CardContent className="pt-8 pb-8">
          <div className="mb-2 flex items-center gap-1.5">
            <p className="text-sm uppercase tracking-wider text-muted-foreground">
              {t(safeLabelKey)}
            </p>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={t(safeLabelKey)}
                  className="text-muted-foreground/70 transition-colors hover:text-foreground"
                >
                  <Info className="size-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                align="start"
                className="w-72 space-y-2 text-xs leading-relaxed"
              >
                <p className="text-sm font-medium text-foreground">{t(safeLabelKey)}</p>
                <p className="text-muted-foreground">{t("dashboard.safe.infoBody")}</p>
                <p className="text-muted-foreground">{t("dashboard.safe.availableInfo")}</p>
                {variablePool > 0 && (
                  <p className="tabular-nums text-muted-foreground">
                    {t("dashboard.safe.infoBreakdown", {
                      remaining: money(remaining),
                      days: daysLeft,
                      perDay: money(safeToday),
                    })}
                  </p>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <p
              className={`text-5xl md:text-6xl font-display ${overspent ? "text-destructive" : "text-primary"}`}
            >
              {isLoading ? (
                <span className="inline-block h-12 w-40 rounded-md bg-muted animate-pulse align-middle" />
              ) : (
                money(safeForHorizon)
              )}
            </p>
            {!isLoading &&
              effHorizon === "today" &&
              variablePool > 0 &&
              Math.abs(trendDelta) >= 0.01 && (
                <span
                  className={`inline-flex items-center gap-1 text-sm font-medium tabular-nums ${trendDelta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"}`}
                >
                  {trendDelta > 0 ? (
                    <TrendingUp className="size-4" />
                  ) : trendDelta < 0 ? (
                    <TrendingDown className="size-4" />
                  ) : (
                    <Minus className="size-4" />
                  )}
                  {t("dashboard.safe.vsYesterday", {
                    value: `${trendDelta > 0 ? "+" : ""}${money(trendDelta)}`,
                  })}
                </span>
              )}
          </div>
          <div className="mt-3 inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs">
            {(["today", "week", "cycle"] as const)
              .filter((h) => h !== "week" || showWeek)
              .map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHorizon(h)}
                  aria-pressed={effHorizon === h}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    effHorizon === h
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(`dashboard.safe.horizon.${h}`)}
                </button>
              ))}
          </div>
          {!isLoading && (
            <div className="mt-4 border-t pt-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t("dashboard.safe.availableLabel")}
                </span>
                <span
                  className={`text-xl font-semibold tabular-nums ${available < 0 ? "text-destructive" : "text-foreground"}`}
                >
                  {money(available)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {available < 0
                  ? t("dashboard.safe.availableNeg")
                  : t("dashboard.safe.availablePos")}
              </p>
            </div>
          )}
          {cycle?.source === "calendar" && (
            <p className="text-xs text-muted-foreground mt-2">{t("dashboard.safe.calendarTip")}</p>
          )}

          {/* Sparkline of net daily spend, matched to the selected horizon */}
          <div className="mt-5">
            <Sparkline days={spark} max={sparkMax} threshold={safeToday} />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
              {t(`dashboard.spark.caption.${effHorizon}`, { days: spark.length })}
            </p>
          </div>

          <div className="mt-6 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setExpenseFilter(expenseFilter === "spent" ? "all" : "spent");
                    document
                      .getElementById("recent-expenses")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`inline-flex items-center rounded-md px-2 py-0.5 font-medium tabular-nums transition-colors bg-orange-500/15 text-orange-700 dark:text-orange-300 hover:bg-orange-500/25 ${expenseFilter === "spent" ? "ring-2 ring-orange-500/50" : ""}`}
                >
                  {t("dashboard.chip.spent", { value: money(spent) })}
                </button>
                {received > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setExpenseFilter(expenseFilter === "received" ? "all" : "received");
                      document
                        .getElementById("recent-expenses")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={`inline-flex items-center rounded-md px-2 py-0.5 font-medium tabular-nums transition-colors bg-blue-500/15 text-blue-700 dark:text-blue-300 hover:bg-blue-500/25 ${expenseFilter === "received" ? "ring-2 ring-blue-500/50" : ""}`}
                  >
                    {t("dashboard.chip.received", { value: money(received) })}
                  </button>
                )}
                <span className="inline-flex items-center rounded-md px-2 py-0.5 font-medium bg-muted text-foreground tabular-nums">
                  {t("dashboard.chip.balance", { value: money(netSpent) })}
                </span>
              </div>
              <span className="text-muted-foreground tabular-nums">
                {t("dashboard.chip.pool", { value: money(variablePool) })}
              </span>
            </div>
            <Progress
              value={pctSpent}
              className={overspent ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}
            />
          </div>

          {/* Payday-driven (event) spaces only: a time-driven cycle rolls on the
              calendar, so there's no "salary received" action to start it. */}
          {householdId && hh?.household?.cycle_mode !== "time" && (
            <div className="mt-6 pt-6 border-t">
              <SalaryReceivedButton
                householdId={householdId}
                lastSalaryAt={cycle?.source === "salary" ? cycle.start : null}
                onDone={() => refetch()}
              />
            </div>
          )}

          {/* Bucket impact */}
          <div className="mt-6 pt-6 border-t">
            {!buckets.length ? (
              <p className="text-xs text-muted-foreground">{t("dashboard.buckets.none")}</p>
            ) : !inJeopardy ? (
              <div className="flex items-start gap-3">
                <span className="mt-1 size-2.5 rounded-full bg-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t("dashboard.buckets.onTrack")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("dashboard.buckets.onTrackBody", {
                      perDay: money(safeToday),
                      count: buckets.length,
                      total: money(totalAllocated),
                    })}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <span className="mt-1 size-2.5 rounded-full bg-destructive shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">
                    {t("dashboard.buckets.overspent", { value: money(overspendAmount) })}
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {jeopardizedBuckets.map((b) => (
                      <li key={b.name} className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ background: b.color ?? "var(--primary)" }}
                        />
                        <span className="font-medium text-foreground">{b.name}</span>
                        <span>−{t("dashboard.buckets.loss", { value: money(b.loss) })}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {householdId && <GoalsCard householdId={householdId} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t("dashboard.stat.beforeLimit")} value={money(remaining)} highlight />
        <StatCard
          label={t("dashboard.stat.projected")}
          value={money(projectedBalance)}
          hint={
            projectedBalance >= 0
              ? t("dashboard.stat.projectedOnPace", { value: money(avgDaily7) })
              : t("dashboard.stat.projectedOver", { value: money(-projectedBalance) })
          }
          tone={projectedBalance >= 0 ? "good" : "bad"}
        />
        <StatCard
          label={t("dashboard.stat.realSurplus")}
          value={money(realSurplus)}
          hint={
            obligation > 0
              ? `${t("dashboard.stat.realSurplusHint")} · ${t("plan.dashThisCycle")} ${money(obligation)}`
              : t("dashboard.stat.realSurplusHint")
          }
          tone={realSurplus < 0 ? "bad" : undefined}
        />
        <StatCard label={t("dashboard.stat.monthlyIncome")} value={money(dashboard?.income ?? 0)} />
      </div>

      {householdId && <NetWorthCard householdId={householdId} />}

      {householdId && <MomentumCard householdId={householdId} />}

      {householdId && (
        <DashboardTips
          householdId={householdId}
          isBusiness={hh?.household?.kind === "business"}
          baseline={baseline}
          income={income}
          surplus={surplus}
          variablePool={variablePool}
          netSpent={netSpent}
          daysLeft={daysLeft}
          avgDaily7={avgDaily7}
        />
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("dashboard.quickAdd.title")}</CardTitle>
            <CardDescription>{t("dashboard.quickAdd.desc")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {householdId && <ExpenseQuickAdd householdId={householdId} onAdded={() => refetch()} />}
        </CardContent>
      </Card>

      <Card id="recent-expenses">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle>{t("dashboard.recent.title")}</CardTitle>
            {expenseFilter !== "all" && (
              <button
                type="button"
                onClick={() => setExpenseFilter("all")}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                {t("dashboard.recent.showing", { filter: t(`dashboard.filter.${expenseFilter}`) })}
              </button>
            )}
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/expenses">{t("dashboard.recent.viewAll")}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {(() => {
            const list = (dashboard?.recent ?? []).filter((e) =>
              expenseFilter === "all"
                ? true
                : expenseFilter === "received"
                  ? e.kind === "income" && !e.is_salary
                  : e.kind !== "income",
            );
            if (!list.length)
              return <p className="text-sm text-muted-foreground">{t("dashboard.recent.none")}</p>;
            return (
              <ul className="divide-y">
                {list.map((e) => {
                  const isIncome = e.kind === "income";
                  return (
                    <li key={e.id} className="flex items-center justify-between py-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{e.merchant || e.note || e.category}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDateTime(e.occurred_at)} · {e.category}
                          {isIncome ? ` · ${t("dashboard.recent.received")}` : ""}
                        </p>
                      </div>
                      <p className={`font-medium tabular-nums ${isIncome ? "text-primary" : ""}`}>
                        {isIncome ? "+" : "−"}
                        {money(e.amount)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}

function SalaryReceivedButton({
  householdId,
  lastSalaryAt,
  onDone,
}: {
  householdId: string;
  lastSalaryAt: Date | null;
  onDone: () => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const markIncome = useServerFn(markIncomeReceived);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [amountStr, setAmountStr] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestAmount, setSuggestAmount] = useState(0);
  // Don't re-trigger if a salary was already recorded within the last 5 days
  const recentlyReceived = lastSalaryAt && Date.now() - lastSalaryAt.getTime() < 5 * 86400_000;

  // The income this button reconciles: the cycle anchor, else the first salary,
  // else the first income. We keep its expected amount so the confirm dialog can
  // prefill it while letting the user correct this month's actual figure.
  const { data: primaryIncome } = useQuery({
    queryKey: ["primary-income", householdId],
    queryFn: async () => {
      const [{ data: hh }, { data: incs }] = await Promise.all([
        supabase
          .from("households")
          .select("cycle_anchor_income_id")
          .eq("id", householdId)
          .maybeSingle(),
        supabase
          .from("incomes")
          .select("id, type, native_amount, monthly_amount")
          .eq("household_id", householdId)
          .order("created_at"),
      ]);
      const list = incs ?? [];
      const anchor = hh?.cycle_anchor_income_id
        ? list.find((i) => i.id === hh.cycle_anchor_income_id)
        : null;
      const salary = list.find((i) => i.type === "salary");
      const chosen = anchor ?? salary ?? list[0] ?? null;
      if (!chosen) return null;
      return {
        id: chosen.id as string,
        amount: Number(chosen.native_amount ?? chosen.monthly_amount) || 0,
      };
    },
  });

  function openDialog() {
    if (!primaryIncome) {
      toast.error(t("dashboard.salary.needIncome"));
      return;
    }
    if (recentlyReceived) {
      const ok = window.confirm(
        t("dashboard.salary.confirmDuplicate", { date: fmtDate(lastSalaryAt!) }),
      );
      if (!ok) return;
    }
    setAmountStr(primaryIncome.amount ? primaryIncome.amount.toFixed(2) : "");
    setOpen(true);
  }

  async function confirm() {
    if (!primaryIncome) return;
    const amount = Number(amountStr);
    if (!(amount > 0)) {
      toast.error(t("dashboard.salary.badAmount"));
      return;
    }
    setLoading(true);
    try {
      const row = await markIncome({
        data: { household_id: householdId, income_id: primaryIncome.id, amount },
      });
      toast.success(t("dashboard.salary.recordedToast"));
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["salaries"] });
      qc.invalidateQueries({ queryKey: ["expenses-list"] });
      qc.invalidateQueries({ queryKey: ["cycle-committed"] });
      onDone();
      setOpen(false);
      const amt = Number(row?.amount ?? amount);
      if (amt > 0) {
        setSuggestAmount(amt);
        setSuggestOpen(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("dashboard.failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <p className="text-sm font-medium">{t("dashboard.salary.payday")}</p>
          <p className="text-xs text-muted-foreground">
            {lastSalaryAt
              ? t("dashboard.salary.last", { date: fmtDate(lastSalaryAt) })
              : t("dashboard.salary.none")}{" "}
            {t("dashboard.salary.usesSettings")}
          </p>
        </div>
        <Button
          onClick={openDialog}
          disabled={loading}
          variant={recentlyReceived ? "outline" : "default"}
        >
          {loading ? <Loader2 className="animate-spin" /> : <Wallet />}{" "}
          {t("dashboard.salary.button")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dashboard.salary.confirmTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("dashboard.salary.amountLabel")}</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                autoFocus
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("dashboard.salary.amountHint")}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={confirm} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("dashboard.salary.confirmCta")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <IncomeAllocationSuggestion
        householdId={householdId}
        amount={suggestAmount}
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
      />
    </>
  );
}

function StatCard({
  label,
  value,
  highlight,
  hint,
  tone,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  hint?: string;
  tone?: "good" | "bad";
}) {
  const toneCls =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "bad"
        ? "text-destructive"
        : "";
  return (
    <Card className={`h-full ${highlight ? "border-primary/40 bg-primary/5" : ""}`}>
      <CardContent className="pt-6 h-full flex flex-col">
        <p className="text-xs uppercase tracking-wider text-muted-foreground min-h-[2rem] leading-tight">
          {label}
        </p>
        <p className={`text-2xl font-display mt-1 tabular-nums whitespace-nowrap ${toneCls}`}>
          {value}
        </p>
        {hint && <p className="text-xs text-muted-foreground mt-auto pt-2">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Sparkline({
  days,
  max,
  threshold,
}: {
  days: { key: string; label: string; net: number }[];
  max: number;
  threshold: number;
}) {
  const t = useT();
  const w = 280;
  const h = 44;
  const pad = 2;
  const step = (w - pad * 2) / Math.max(1, days.length - 1);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const pts = days.map((d, i) => `${pad + i * step},${y(d.net)}`).join(" ");
  const thY = y(threshold);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-11 overflow-visible"
      aria-label={t("dashboard.sparklineAria")}
    >
      <line
        x1={pad}
        x2={w - pad}
        y1={thY}
        y2={thY}
        stroke="currentColor"
        strokeWidth={1}
        strokeDasharray="3 3"
        className="text-muted-foreground/50"
      />
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        points={pts}
        className="text-primary"
      />
      {days.map((d, i) => (
        <g key={d.key}>
          <circle
            cx={pad + i * step}
            cy={y(d.net)}
            r={2}
            className={d.net > threshold ? "fill-orange-500" : "fill-primary"}
          />
          <title>
            {d.label} · {money(d.net)}
          </title>
        </g>
      ))}
    </svg>
  );
}
