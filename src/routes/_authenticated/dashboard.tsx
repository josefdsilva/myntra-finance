import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { money, fmtDateTime, fmtDate } from "@/lib/format";
import { computeCycle } from "@/lib/cycle";
import { ExpenseQuickAdd } from "@/components/expense-quick-add";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { markSalaryReceived } from "@/lib/budget.functions";
import { toast } from "sonner";
import { Wallet, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { DashboardTips } from "@/components/dashboard-tips";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Myntra" }] }),
  component: Dashboard,
});

function Dashboard() {
  const fetchHousehold = useServerFn(getOrCreateHousehold);
  const { data: hh } = useQuery({
    queryKey: ["household"],
    queryFn: () => fetchHousehold(),
  });

  const householdId = hh?.household?.id;

  const { data: dashboard, refetch, isLoading: dashboardLoading } = useQuery({
    enabled: !!householdId,
    queryKey: ["dashboard", householdId],
    queryFn: async () => {
      // 1) Detect cycle from salary income entries
      const { data: salaries } = await supabase
        .from("expenses")
        .select("occurred_at")
        .eq("household_id", householdId!)
        .eq("kind", "income")
        .eq("is_salary", true)
        .order("occurred_at", { ascending: false })
        .limit(6);
      const cycle = computeCycle((salaries ?? []).map((r) => r.occurred_at as string));

      const [{ data: fixed }, { data: expenses }, { data: incomes }, { data: buckets }] = await Promise.all([
        supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", householdId!),
        supabase
          .from("expenses")
          .select("id, amount, category, merchant, occurred_at, note, source, kind, is_salary")
          .eq("household_id", householdId!)
          .gte("occurred_at", cycle.start.toISOString())
          .lt("occurred_at", cycle.end.toISOString())
          .order("occurred_at", { ascending: false }),
        supabase.from("incomes").select("monthly_amount").eq("household_id", householdId!),
        supabase.from("buckets").select("id, name, target_type, target_value, target_deadline, color").eq("household_id", householdId!).order("sort_order"),
      ]);
      const fixedTotal = (fixed ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      const spent = (expenses ?? []).filter((r) => r.kind !== "income").reduce((s, r) => s + Number(r.amount), 0);
      // Exclude salary deposits from "received" — they're the income, not a top-up
      const received = (expenses ?? [])
        .filter((r) => r.kind === "income" && !r.is_salary)
        .reduce((s, r) => s + Number(r.amount), 0);
      const income = (incomes ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      return {
        cycle,
        fixedTotal,
        spent,
        received,
        income,
        buckets: buckets ?? [],
        recent: (expenses ?? []).slice(0, 10),
        expenses: expenses ?? [],
        totalExpenses: expenses?.length ?? 0,
      };
    },
  });

  const [expenseFilter, setExpenseFilter] = useState<"all" | "spent" | "received">("all");

  const baseline = Number(hh?.household?.baseline_budget ?? 0);
  const variablePool = Math.max(0, baseline - (dashboard?.fixedTotal ?? 0));
  const spent = dashboard?.spent ?? 0;
  const received = dashboard?.received ?? 0;
  const netSpent = Math.max(0, spent - received);
  const remaining = Math.max(0, variablePool - netSpent);
  const overspent = netSpent > variablePool;
  const cycle = dashboard?.cycle;
  const daysLeft = cycle?.daysLeft ?? 1;
  const safeToday = variablePool > 0 ? remaining / daysLeft : 0;
  const pctSpent = variablePool > 0 ? Math.min(100, (netSpent / variablePool) * 100) : 0;

  const income = dashboard?.income ?? 0;
  const surplus = Math.max(0, income - baseline);
  const overspendAmount = Math.max(0, netSpent - variablePool);
  const buckets = dashboard?.buckets ?? [];

  // Trend: compare with yesterday's safe-to-spend (spent through end of yesterday, days-left as of yesterday)
  const allExpenses = dashboard?.expenses ?? [];
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
  const safeYesterday = variablePool > 0 ? Math.max(0, variablePool - netSpentThroughYesterday) / daysLeftYesterday : 0;
  const trendDelta = safeToday - safeYesterday;

  // 7-day sparkline of daily net spend (spent - non-salary income)
  const spark = useMemo(() => {
    const days: { key: string; label: string; net: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const spent = allExpenses
        .filter((r) => r.kind !== "income" && new Date(r.occurred_at) >= d && new Date(r.occurred_at) < next)
        .reduce((s, r) => s + Number(r.amount), 0);
      const rc = allExpenses
        .filter((r) => r.kind === "income" && !r.is_salary && new Date(r.occurred_at) >= d && new Date(r.occurred_at) < next)
        .reduce((s, r) => s + Number(r.amount), 0);
      days.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-GB", { weekday: "short" }), net: Math.max(0, spent - rc) });
    }
    return days;
  }, [allExpenses]);
  const sparkMax = Math.max(safeToday, ...spark.map((d) => d.net), 1);
  const avgDaily7 = spark.reduce((s, d) => s + d.net, 0) / Math.max(1, spark.length);
  const projectedBalance = remaining - avgDaily7 * daysLeft;

  function monthsUntil(dateStr: string | null): number {
    if (!dateStr) return 1;
    const t = new Date(dateStr);
    const n = new Date();
    const m = (t.getFullYear() - n.getFullYear()) * 12 + (t.getMonth() - n.getMonth()) + (t.getDate() >= n.getDate() ? 0 : -1) + 1;
    return Math.max(1, m);
  }
  function bucketMonthly(b: typeof buckets[number]): number {
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

  const monthName = useMemo(() => new Date().toLocaleString("en-GB", { month: "long", year: "numeric" }), []);
  const cycleLabel = cycle
    ? cycle.source === "salary"
      ? `Pay cycle · ${fmtDate(cycle.start)} → ${fmtDate(cycle.end)}${cycle.predicted ? " (predicted)" : ""}`
      : `Calendar month · ${monthName} (no salary recorded yet)`
    : monthName;

  const setupIncomplete = baseline === 0;
  const isLoading = !hh || dashboardLoading || !dashboard;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">{cycleLabel}</p>
        <h1 className="text-3xl md:text-4xl font-display">Daily overview</h1>
      </header>


      {setupIncomplete ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-6">
            <div>
              <p className="font-medium">Set up your monthly baseline to see your daily safe-to-spend.</p>
              <p className="text-sm text-muted-foreground">Add income, fixed expenses and your baseline budget in Settings.</p>
            </div>
            <Button asChild><Link to="/settings">Go to settings</Link></Button>
          </CardContent>
        </Card>
      ) : null}


      {/* Hero: safe to spend today */}
      <Card className="overflow-hidden">
        <CardContent className="pt-8 pb-8">
          <p className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Safe to spend per day</p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <p className={`text-5xl md:text-6xl font-display ${overspent ? "text-destructive" : "text-primary"}`}>
              {money(safeToday)}
            </p>
            {variablePool > 0 && Math.abs(trendDelta) >= 0.01 && (
              <span className={`inline-flex items-center gap-1 text-sm font-medium tabular-nums ${trendDelta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"}`}>
                {trendDelta > 0 ? <TrendingUp className="size-4" /> : trendDelta < 0 ? <TrendingDown className="size-4" /> : <Minus className="size-4" />}
                {trendDelta > 0 ? "+" : ""}{money(trendDelta)} vs yesterday
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-3 tabular-nums">
            {money(remaining)} remaining ÷ {daysLeft} day{daysLeft === 1 ? "" : "s"} until {cycle?.source === "salary" ? "next salary" : "month end"} ={" "}
            <span className="font-medium text-foreground">{money(safeToday)}/day</span>
          </p>
          {cycle?.source === "calendar" && (
            <p className="text-xs text-muted-foreground mt-2">
              Tip: press <span className="font-medium">Salary received</span> below on payday to start a new pay cycle.
            </p>
          )}

          {/* 7-day sparkline of net daily spend */}
          <div className="mt-5">
            <Sparkline days={spark} max={sparkMax} threshold={safeToday} />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Last 7 days · dashed line = today's safe-to-spend</p>
          </div>

          <div className="mt-6 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => { setExpenseFilter(expenseFilter === "spent" ? "all" : "spent"); document.getElementById("recent-expenses")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                  className={`inline-flex items-center rounded-md px-2 py-0.5 font-medium tabular-nums transition-colors bg-orange-500/15 text-orange-700 dark:text-orange-300 hover:bg-orange-500/25 ${expenseFilter === "spent" ? "ring-2 ring-orange-500/50" : ""}`}
                >
                  Spent {money(spent)}
                </button>
                {received > 0 && (
                  <button
                    type="button"
                    onClick={() => { setExpenseFilter(expenseFilter === "received" ? "all" : "received"); document.getElementById("recent-expenses")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                    className={`inline-flex items-center rounded-md px-2 py-0.5 font-medium tabular-nums transition-colors bg-blue-500/15 text-blue-700 dark:text-blue-300 hover:bg-blue-500/25 ${expenseFilter === "received" ? "ring-2 ring-blue-500/50" : ""}`}
                  >
                    Received {money(received)}
                  </button>
                )}
                <span className="inline-flex items-center rounded-md px-2 py-0.5 font-medium bg-muted text-foreground tabular-nums">
                  Balance {money(netSpent)}
                </span>
              </div>
              <span className="text-muted-foreground tabular-nums">{money(variablePool)} pool</span>
            </div>
            <Progress value={pctSpent} className={overspent ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"} />
          </div>

          <div className="mt-6 pt-6 border-t">
            {householdId && <SalaryReceivedButton householdId={householdId} lastSalaryAt={cycle?.source === "salary" ? cycle.start : null} onDone={() => refetch()} />}
          </div>

          {/* Bucket impact */}
          <div className="mt-6 pt-6 border-t">
            {!buckets.length ? (
              <p className="text-xs text-muted-foreground">
                No savings buckets configured — set targets in <Link to="/settings" className="underline">Settings</Link> to see impact.
              </p>
            ) : !inJeopardy ? (
              <div className="flex items-start gap-3">
                <span className="mt-1 size-2.5 rounded-full bg-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Buckets on track</p>
                  <p className="text-xs text-muted-foreground">
                    Spending up to {money(safeToday)}/day keeps all {buckets.length} bucket{buckets.length === 1 ? "" : "s"} fully funded this month
                    ({money(totalAllocated)} total).
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <span className="mt-1 size-2.5 rounded-full bg-destructive shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">
                    Overspent by {money(overspendAmount)} — buckets at risk
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {jeopardizedBuckets.map((b) => (
                      <li key={b.name} className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ background: b.color ?? "var(--primary)" }} />
                        <span className="font-medium text-foreground">{b.name}</span>
                        <span>−{money(b.loss)} this month</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Before baseline limit" value={money(remaining)} highlight />
        <StatCard
          label="Projected end of cycle"
          value={money(projectedBalance)}
          hint={projectedBalance >= 0 ? `On pace (${money(avgDaily7)}/day avg)` : `At current pace, over by ${money(-projectedBalance)}`}
          tone={projectedBalance >= 0 ? "good" : "bad"}
        />
        <StatCard label="Emergency pool" value={money(Math.max(0, surplus - totalAllocated))} hint="Unallocated surplus" />
        <StatCard label="Monthly income" value={money(dashboard?.income ?? 0)} />
      </div>





      {householdId && (
        <DashboardTips
          householdId={householdId}
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
            <CardTitle>Quick add</CardTitle>
            <CardDescription>Type or say what you spent — we'll parse it.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {householdId && <ExpenseQuickAdd householdId={householdId} onAdded={() => refetch()} />}
        </CardContent>
      </Card>

      <Card id="recent-expenses">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle>Recent expenses</CardTitle>
            {expenseFilter !== "all" && (
              <button
                type="button"
                onClick={() => setExpenseFilter("all")}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Showing {expenseFilter} — clear
              </button>
            )}
          </div>
          <Button asChild variant="ghost" size="sm"><Link to="/expenses">View all</Link></Button>
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
            if (!list.length) return <p className="text-sm text-muted-foreground">No entries.</p>;
            return (
              <ul className="divide-y">
                {list.map((e) => {
                  const isIncome = e.kind === "income";
                  return (
                    <li key={e.id} className="flex items-center justify-between py-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{e.merchant || e.note || e.category}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDateTime(e.occurred_at)} · {e.category}{isIncome ? " · received" : ""}
                        </p>
                      </div>
                      <p className={`font-medium tabular-nums ${isIncome ? "text-primary" : ""}`}>
                        {isIncome ? "+" : "−"}{money(e.amount)}
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

function SalaryReceivedButton({ householdId, lastSalaryAt, onDone }: { householdId: string; lastSalaryAt: Date | null; onDone: () => void }) {
  const qc = useQueryClient();
  const mark = useServerFn(markSalaryReceived);
  const [loading, setLoading] = useState(false);
  // Don't re-trigger if a salary was already recorded within the last 5 days
  const recentlyReceived = lastSalaryAt && (Date.now() - lastSalaryAt.getTime()) < 5 * 86400_000;

  async function onClick() {
    if (recentlyReceived) {
      const ok = window.confirm(`Last salary was recorded on ${fmtDate(lastSalaryAt!)}. Record another?`);
      if (!ok) return;
    }
    setLoading(true);
    try {
      await mark({ data: { household_id: householdId } });
      toast.success("Salary recorded — new cycle started");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["salaries"] });
      qc.invalidateQueries({ queryKey: ["expenses-list"] });
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div>
        <p className="text-sm font-medium">Payday?</p>
        <p className="text-xs text-muted-foreground">
          {lastSalaryAt ? `Last salary: ${fmtDate(lastSalaryAt)}` : "No salary recorded yet."} Uses your Settings income total.
        </p>
      </div>
      <Button onClick={onClick} disabled={loading} variant={recentlyReceived ? "outline" : "default"}>
        {loading ? <Loader2 className="animate-spin" /> : <Wallet />} Salary received — start new cycle
      </Button>
    </div>
  );
}

function StatCard({ label, value, highlight, hint, tone }: { label: string; value: string; highlight?: boolean; hint?: string; tone?: "good" | "bad" }) {
  const toneCls = tone === "good" ? "text-emerald-600 dark:text-emerald-400" : tone === "bad" ? "text-destructive" : "";
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/5" : ""}>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-2xl font-display mt-1 ${toneCls}`}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Sparkline({ days, max, threshold }: { days: { key: string; label: string; net: number }[]; max: number; threshold: number }) {
  const w = 280;
  const h = 44;
  const pad = 2;
  const step = (w - pad * 2) / Math.max(1, days.length - 1);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const pts = days.map((d, i) => `${pad + i * step},${y(d.net)}`).join(" ");
  const thY = y(threshold);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-11 overflow-visible" aria-label="Last 7 days spend">
      <line x1={pad} x2={w - pad} y1={thY} y2={thY} stroke="currentColor" strokeWidth={1} strokeDasharray="3 3" className="text-muted-foreground/50" />
      <polyline fill="none" stroke="currentColor" strokeWidth={1.5} points={pts} className="text-primary" />
      {days.map((d, i) => (
        <g key={d.key}>
          <circle cx={pad + i * step} cy={y(d.net)} r={2} className={d.net > threshold ? "fill-orange-500" : "fill-primary"} />
          <title>{d.label} · {new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(d.net)}</title>
        </g>
      ))}
    </svg>
  );
}
