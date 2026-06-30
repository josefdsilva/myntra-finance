import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { money, fmtDateTime, fmtDate } from "@/lib/format";
import { computeCycle } from "@/lib/cycle";
import { ExpenseQuickAdd } from "@/components/expense-quick-add";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Household Budget" }] }),
  component: Dashboard,
});

function Dashboard() {
  const fetchHousehold = useServerFn(getOrCreateHousehold);
  const { data: hh } = useQuery({
    queryKey: ["household"],
    queryFn: () => fetchHousehold(),
  });

  const householdId = hh?.household?.id;

  const { data: dashboard, refetch } = useQuery({
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
        totalExpenses: expenses?.length ?? 0,
      };
    },
  });

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

  // Bucket jeopardy: any overspend eats into surplus → reduces bucket allocations
  const income = dashboard?.income ?? 0;
  const surplus = Math.max(0, income - baseline);
  const overspendAmount = Math.max(0, netSpent - variablePool);
  const buckets = dashboard?.buckets ?? [];

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

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">{cycleLabel}</p>
        <h1 className="text-3xl md:text-4xl font-display">Daily overview</h1>
      </header>


      {setupIncomplete && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-6">
            <div>
              <p className="font-medium">Set up your monthly baseline to see your daily safe-to-spend.</p>
              <p className="text-sm text-muted-foreground">Add income, fixed expenses and your baseline budget in Settings.</p>
            </div>
            <Button asChild><Link to="/settings">Go to settings</Link></Button>
          </CardContent>
        </Card>
      )}

      {/* Hero: safe to spend today */}
      <Card className="overflow-hidden">
        <CardContent className="pt-8 pb-8">
          <p className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Safe to spend per day</p>
          <p className={`text-5xl md:text-6xl font-display ${overspent ? "text-destructive" : "text-primary"}`}>
            {money(safeToday)}
          </p>
          <p className="text-sm text-muted-foreground mt-3 tabular-nums">
            {money(remaining)} remaining ÷ {daysLeft} day{daysLeft === 1 ? "" : "s"} left ={" "}
            <span className="font-medium text-foreground">{money(safeToday)}/day</span>
          </p>
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{money(spent)} spent{received > 0 ? ` · −${money(received)} received` : ""}</span>
              <span>{money(variablePool)} pool</span>
            </div>
            <Progress value={pctSpent} className={overspent ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"} />
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
        <StatCard label="Emergency pool" value={money(Math.max(0, surplus - totalAllocated))} hint="Unallocated surplus" />
        <StatCard label="Monthly income" value={money(dashboard?.income ?? 0)} />
        <StatCard label="Fixed expenses" value={money(dashboard?.fixedTotal ?? 0)} />
      </div>



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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent expenses</CardTitle>
          <Button asChild variant="ghost" size="sm"><Link to="/expenses">View all</Link></Button>
        </CardHeader>
        <CardContent>
          {!dashboard?.recent?.length ? (
            <p className="text-sm text-muted-foreground">No expenses yet this month.</p>
          ) : (
            <ul className="divide-y">
              {dashboard.recent.map((e) => {
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, highlight, hint }: { label: string; value: string; highlight?: boolean; hint?: string }) {
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/5" : ""}>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-2xl font-display mt-1">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}
