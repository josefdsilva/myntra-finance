import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { money, fmtDateTime, daysRemainingInMonth, monthBounds } from "@/lib/format";
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
      const { start, end } = monthBounds();
      const [{ data: fixed }, { data: expenses }, { data: incomes }] = await Promise.all([
        supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", householdId!),
        supabase
          .from("expenses")
          .select("id, amount, category, merchant, occurred_at, note, source")
          .eq("household_id", householdId!)
          .gte("occurred_at", start.toISOString())
          .lt("occurred_at", end.toISOString())
          .order("occurred_at", { ascending: false }),
        supabase.from("incomes").select("monthly_amount").eq("household_id", householdId!),
      ]);
      const fixedTotal = (fixed ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      const spent = (expenses ?? []).reduce((s, r) => s + Number(r.amount), 0);
      const income = (incomes ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      return { fixedTotal, spent, income, recent: (expenses ?? []).slice(0, 10), totalExpenses: expenses?.length ?? 0 };
    },
  });

  const baseline = Number(hh?.household?.baseline_budget ?? 0);
  const variablePool = Math.max(0, baseline - (dashboard?.fixedTotal ?? 0));
  const spent = dashboard?.spent ?? 0;
  const remaining = Math.max(0, variablePool - spent);
  const overspent = spent > variablePool;
  const daysLeft = daysRemainingInMonth();
  const safeToday = variablePool > 0 ? Math.max(0, remaining / daysLeft) : 0;
  const pctSpent = variablePool > 0 ? Math.min(100, (spent / variablePool) * 100) : 0;

  const monthName = useMemo(() => new Date().toLocaleString("en-GB", { month: "long", year: "numeric" }), []);

  const setupIncomplete = baseline === 0;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">{monthName}</p>
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
          <p className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Safe to spend today</p>
          <p className={`text-5xl md:text-6xl font-display ${overspent ? "text-destructive" : "text-primary"}`}>
            {money(safeToday)}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {daysLeft} day{daysLeft === 1 ? "" : "s"} left · {money(remaining)} remaining in variable budget
          </p>
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{money(spent)} spent</span>
              <span>{money(variablePool)} pool</span>
            </div>
            <Progress value={pctSpent} className={overspent ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Monthly income" value={money(dashboard?.income ?? 0)} />
        <StatCard label="Fixed expenses" value={money(dashboard?.fixedTotal ?? 0)} />
        <StatCard label="Variable pool" value={money(variablePool)} />
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
              {dashboard.recent.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{e.merchant || e.note || e.category}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDateTime(e.occurred_at)} · {e.category}
                    </p>
                  </div>
                  <p className="font-medium tabular-nums">{money(e.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-2xl font-display mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
