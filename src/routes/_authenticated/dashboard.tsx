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
import { Wallet, Loader2, Info, CalendarClock, X } from "lucide-react";
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
import { JourneySummaryCard } from "@/components/journey-summary-card";
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
      // Salary money that actually landed this cycle (the anchor income receipt).
      const salaryIn = (expenses ?? [])
        .filter((r) => r.kind === "income" && r.is_salary)
        .reduce((s, r) => s + Number(r.amount), 0);
      const income = incomes.reduce((s, r) => s + Number(r.monthly_amount), 0);
      return {
        cycle,
        fixedTotal,
        spent,
        received,
        salaryIn,
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
      // Scope to the payday cycle, not the calendar month. Allocations are keyed
      // by the cycle-start date, so filter confirmed allocations by confirmed_at
      // within the cycle window (matching the projects page) rather than a
      // first-of-month period key, which silently dropped top-ups on cycles that
      // don't start on the 1st.
      const bounds = await fetchCycleBounds(supabase, householdId!, hh?.household);
      const [{ data: confs }, { data: moves }] = await Promise.all([
        supabase
          .from("bucket_allocations")
          .select("amount")
          .eq("household_id", householdId!)
          .gte("confirmed_at", bounds.start.toISOString())
          .lt("confirmed_at", bounds.end.toISOString()),
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
  // Expenses that settled a plan/project — so we can tell everyday spending apart
  // from money that came out of a project's savings.
  const { data: planExpenseIds } = useQuery({
    enabled: !!householdId,
    queryKey: ["dashboard-plan-expense-ids", householdId],
    queryFn: async () => {
      const { data } = await supabase
        .from("plans")
        .select("expense_id")
        .eq("household_id", householdId!)
        .not("expense_id", "is", null);
      return new Set((data ?? []).map((r) => r.expense_id as string));
    },
  });

  const [plansNudgeDismissed, setPlansNudgeDismissed] = useState(false);

  const [expenseFilter, setExpenseFilter] = useState<"all" | "spent" | "received">("all");

  const baseline = Number(hh?.household?.baseline_budget ?? 0);
  const income = dashboard?.income ?? 0;
  const marginPct = Number(hh?.household?.margin_pct ?? 0);
  const surplus = Math.max(0, income - baseline);
  const realAllocated = realAlloc ?? 0;

  // Plans claim the unallocated leftover surplus first; whatever they can't cover
  // surfaces as pressure on the real-surplus stat below.
  // Discretionary money this cycle = recurring surplus + one-off money received
  // (a windfall funds real allocations, so leaving it out made real surplus look
  // deeply negative when you set aside more than your recurring surplus).
  const leftover0 = Math.max(0, surplus + (dashboard?.received ?? 0) - realAllocated);
  const obligation = plannedThisCycle ?? 0;
  const realSurplus = leftover0 - Math.min(obligation, leftover0);

  const fixedTotal = dashboard?.fixedTotal ?? 0;
  // Everyday budget = the baseline variable pool (variable estimate + safety
  // margin), i.e. baseline minus fixed + debt.
  const variablePool = Math.max(0, baseline - fixedTotal);

  // --- This cycle's actual cash (the "cash in and out" lens) ---
  const salaryIn = dashboard?.salaryIn ?? 0;
  const received = dashboard?.received ?? 0; // non-salary money in (top-ups, windfalls)
  const totalIn = salaryIn + received;
  const spent = dashboard?.spent ?? 0; // every non-income outflow this cycle
  // Money that settled a project/plan is funded from savings, not the everyday
  // budget, so keep it apart from everyday spending.
  const projectPaid = useMemo(() => {
    if (!planExpenseIds || !dashboard) return 0;
    return dashboard.expenses
      .filter((e) => e.kind !== "income" && planExpenseIds.has(e.id))
      .reduce((s, e) => s + Number(e.amount), 0);
  }, [planExpenseIds, dashboard]);
  // Everyday spend is the honest figure: variable outflows only, and crucially
  // NOT offset by money that came in — a windfall must never silently refill the
  // everyday budget.
  const everydaySpent = Math.max(0, spent - projectPaid);

  // --- Your spending plan (what's safe, and why) ---
  const freeThisCycle = income - fixedTotal; // = everyday budget + spare
  const spare = surplus; // free cash above the everyday budget

  // Honest everyday allowance: what's left of the everyday budget over the days
  // remaining. The everyday budget is its own envelope (variable estimate +
  // safety margin), kept apart from money set aside for projects, so it is NOT
  // capped by remaining free cash — that cap was zeroing the daily number even
  // when the everyday budget clearly still had room.
  const everydayLeft = Math.max(0, variablePool - everydaySpent);
  const remaining = everydayLeft;
  const overspendAmount = Math.max(0, everydaySpent - variablePool);
  const overspent = everydaySpent > variablePool;

  const cycle = dashboard?.cycle;
  const daysLeft = cycle?.daysLeft ?? 1;
  // A cycle "just rolled over" in its first few days. Pair that with any open
  // plans landing this cycle to nudge the user before the money is spent.
  const daysSinceCycleStart = cycle?.start
    ? Math.floor((Date.now() - new Date(cycle.start).getTime()) / 86400000)
    : 999;
  const upcomingPlanCount = upcomingPlans?.length ?? 0;
  const showPlansNudge = !plansNudgeDismissed && daysSinceCycleStart <= 3 && upcomingPlanCount > 0;

  const safeToday = daysLeft > 0 ? remaining / daysLeft : 0;
  const safeWeek = safeToday * Math.min(7, daysLeft);
  const pctEveryday = variablePool > 0 ? Math.min(100, (everydaySpent / variablePool) * 100) : 0;
  const buckets = dashboard?.buckets ?? [];

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
  // Show the last 7 days of everyday spend as a compact trend under the hero.
  const spark = useMemo(() => sparkAll.slice(Math.max(0, sparkAll.length - 7)), [sparkAll]);
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
        {householdId && <PurchaseCheckButton />}
      </header>

      {!isLoading && householdId && (
        <SetupChecklist householdId={householdId} household={hh?.household ?? null} />
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

      {/* Hero: honest safe-to-spend per day + two lenses */}
      <Card className="overflow-hidden">
        <CardContent className="pt-8 pb-8">
          <div className="mb-1 flex items-center gap-1.5">
            <p className="text-sm text-muted-foreground">{t("dashboard.safe.perDayLabel")}</p>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={t("dashboard.safe.perDayLabel")}
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
                <p className="text-sm font-medium text-foreground">
                  {t("dashboard.safe.perDayLabel")}
                </p>
                <p className="text-muted-foreground">{t("dashboard.safe.infoEveryday")}</p>
                {variablePool > 0 && (
                  <p className="tabular-nums text-muted-foreground">
                    {t("dashboard.safe.infoBreakdown", {
                      remaining: money(everydayLeft),
                      days: daysLeft,
                      perDay: money(safeToday),
                    })}
                  </p>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-baseline gap-2">
            <p
              className={`text-5xl md:text-6xl font-display ${overspent ? "text-destructive" : "text-primary"}`}
            >
              {isLoading ? (
                <span className="inline-block h-12 w-40 rounded-md bg-muted animate-pulse align-middle" />
              ) : (
                money(safeToday)
              )}
            </p>
            {!isLoading && (
              <span className="text-base text-muted-foreground">{t("dashboard.safe.perDayUnit")}</span>
            )}
          </div>
          {!isLoading && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t("dashboard.safe.subline", {
                week: money(safeWeek),
                cycle: money(everydayLeft),
              })}
            </p>
          )}
          {cycle?.source === "calendar" && (
            <p className="text-xs text-muted-foreground mt-2">{t("dashboard.safe.calendarTip")}</p>
          )}

          {/* Compact 7-day trend of everyday spend */}
          {!isLoading && (
            <div className="mt-5">
              <Sparkline days={spark} max={sparkMax} threshold={safeToday} />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                {t("dashboard.spark.caption.week", { days: spark.length })}
              </p>
            </div>
          )}

          {/* Two lenses: cash in/out, and the spending plan */}
          {!isLoading && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {/* Lens A — cash in and out */}
              <div className="rounded-lg bg-muted/40 p-4">
                <p className="text-sm font-medium">{t("dashboard.lens.cashTitle")}</p>
                <p className="mb-3 text-xs text-muted-foreground">{t("dashboard.lens.cashSub")}</p>

                <p className="mb-1 text-xs text-muted-foreground">{t("dashboard.lens.moneyIn")}</p>
                {salaryIn > 0 && (
                  <LedgerRow label={t("dashboard.lens.salary")} value={money(salaryIn)} />
                )}
                {received > 0 && (
                  <LedgerRow label={t("dashboard.lens.otherIn")} value={money(received)} />
                )}
                <LedgerRow label={t("dashboard.lens.totalIn")} value={money(totalIn)} strong />

                <p className="mb-1 mt-3 text-xs text-muted-foreground">
                  {t("dashboard.lens.outSoFar")}
                </p>
                <LedgerRow
                  label={t("dashboard.lens.everydaySpending")}
                  value={money(everydaySpent)}
                />
                {projectPaid > 0 && (
                  <LedgerRow label={t("dashboard.lens.plansPaid")} value={money(projectPaid)} />
                )}
                <LedgerRow label={t("dashboard.lens.totalOut")} value={money(spent)} strong />

                {fixedTotal > 0 && (
                  <div className="mt-3 border-t pt-2">
                    <LedgerRow label={t("dashboard.lens.fixedDebt")} value={money(fixedTotal)} />
                    {obligation > 0 && (
                      <LedgerRow
                        label={t("dashboard.lens.plannedAhead")}
                        value={money(obligation)}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Lens B — your spending plan */}
              <div className="rounded-lg bg-muted/40 p-4">
                <p className="text-sm font-medium">{t("dashboard.lens.planTitle")}</p>
                <p className="mb-3 text-xs text-muted-foreground">{t("dashboard.lens.planSub")}</p>

                <LedgerRow label={t("dashboard.lens.regularIncome")} value={money(income)} />
                <LedgerRow
                  label={t("dashboard.lens.minusFixedDebt")}
                  value={`−${money(fixedTotal)}`}
                  muted
                />
                <LedgerRow
                  label={t("dashboard.lens.freeThisCycle")}
                  value={money(freeThisCycle)}
                  strong
                />

                <div className="mt-3 mb-1.5 flex h-2 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${freeThisCycle > 0 ? Math.min(100, (variablePool / freeThisCycle) * 100) : 0}%`,
                    }}
                  />
                  <div className="h-full flex-1 bg-blue-500/70" />
                </div>
                <LedgerRow
                  label={`● ${t("dashboard.lens.everydayBudget")}`}
                  value={money(variablePool)}
                />
                {marginPct > 0 && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t("dashboard.lens.marginNote", { pct: marginPct })}
                  </p>
                )}
                {spare > 0 && (
                  <LedgerRow label={`● ${t("dashboard.lens.spare")}`} value={money(spare)} />
                )}
                {realAllocated > 0 && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t("dashboard.lens.setAside", { amount: money(realAllocated) })}
                  </p>
                )}

                <p className="mb-1 mt-3 text-xs text-muted-foreground">
                  {t("dashboard.lens.everydayUsed", {
                    used: money(everydaySpent),
                    total: money(variablePool),
                  })}
                </p>
                <Progress
                  value={pctEveryday}
                  className={overspent ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {t("dashboard.lens.paceNote", { amount: money(everydayLeft), days: daysLeft })}
                </p>
              </div>
            </div>
          )}

          {/* Principle: extra cash in isn't extra to spend */}
          {!isLoading && received > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-xs text-muted-foreground">
                {t("dashboard.principle", { in: money(totalIn) })}
              </p>
            </div>
          )}

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

      {householdId && <JourneySummaryCard householdId={householdId} />}

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

      {/* Issues & tips sit high on the page — above net worth / momentum — so the
          things that need attention (an unsustainable baseline, an expensive
          debt) reach the eye immediately rather than after a long scroll. */}
      {householdId && <DashboardTips householdId={householdId} />}

      {householdId && <NetWorthCard householdId={householdId} />}

      {householdId && <MomentumCard householdId={householdId} />}

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

function LedgerRow({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-0.5 text-sm tabular-nums ${
        strong ? "mt-1 border-t pt-1.5 font-medium" : ""
      }`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={muted && !strong ? "text-muted-foreground" : "text-foreground"}>{value}</span>
    </div>
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
