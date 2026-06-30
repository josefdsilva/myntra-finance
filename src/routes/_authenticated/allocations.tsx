import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { confirmBucketAllocation, undoBucketAllocation } from "@/lib/bucket-allocations.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { money, yearBounds, monthBounds, fmtDate } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PiggyBank, Check, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/allocations")({
  head: () => ({ meta: [{ title: "Allocations · Household Budget" }] }),
  component: AllocationsPage,
});

type Bucket = {
  id: string;
  name: string;
  target_type: "pct_surplus" | "fixed_monthly" | "fixed_yearly" | "goal_by_date";
  target_value: number;
  target_deadline: string | null;
  color: string | null;
};

function AllocationsPage() {
  const fetchHh = useServerFn(getOrCreateHousehold);
  const { data: hh } = useQuery({ queryKey: ["household"], queryFn: () => fetchHh() });
  const householdId = hh?.household?.id;
  const baseline = Number(hh?.household?.baseline_budget ?? 0);

  const { data } = useQuery({
    enabled: !!householdId,
    queryKey: ["allocations", householdId],
    queryFn: async () => {
      const [{ data: incomes }, { data: buckets }, { data: firstSalary }] = await Promise.all([
        supabase.from("incomes").select("monthly_amount").eq("household_id", householdId!),
        supabase.from("buckets").select("*").eq("household_id", householdId!).order("sort_order"),
        supabase.from("expenses").select("occurred_at").eq("household_id", householdId!).eq("is_salary", true).order("occurred_at", { ascending: true }).limit(1),
      ]);
      const income = (incomes ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      return { income, buckets: (buckets ?? []) as Bucket[], firstSalaryAt: firstSalary?.[0]?.occurred_at ?? null };
    },
  });

  const income = data?.income ?? 0;
  const surplus = Math.max(0, income - baseline);

  function monthsUntil(dateStr: string | null): number {
    if (!dateStr) return 0;
    const target = new Date(dateStr);
    const now = new Date();
    const months =
      (target.getFullYear() - now.getFullYear()) * 12 +
      (target.getMonth() - now.getMonth()) +
      (target.getDate() >= now.getDate() ? 0 : -1) + 1;
    return Math.max(1, months);
  }

  function monthly(b: Bucket): number {
    const v = Number(b.target_value);
    if (b.target_type === "pct_surplus") return (surplus * v) / 100;
    if (b.target_type === "fixed_monthly") return v;
    if (b.target_type === "fixed_yearly") return v / 12;
    return v / monthsUntil(b.target_deadline);
  }

  const totalAllocated = (data?.buckets ?? []).reduce((s, b) => s + monthly(b), 0);
  const unallocated = surplus - totalAllocated;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-display">Allocations</h1>
        <p className="text-sm text-muted-foreground">Where this month's surplus goes.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Monthly income" value={money(income)} />
        <Stat label="Baseline budget" value={money(baseline)} />
        <Stat label="Surplus" value={money(surplus)} highlight />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>This month's buckets</CardTitle>
          <CardDescription>
            Configure targets in <Link to="/settings" className="underline">Settings</Link>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.buckets?.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No buckets configured yet.</p>
          ) : (
            <div className="space-y-4">
              {data.buckets.map((b) => {
                const amount = monthly(b);
                const pct = surplus > 0 ? Math.min(100, (amount / surplus) * 100) : 0;
                return (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex justify-between items-baseline">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: b.color ?? "var(--primary)" }} />
                        <span className="font-medium">{b.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {b.target_type === "pct_surplus" ? `${b.target_value}% of surplus`
                           : b.target_type === "fixed_monthly" ? `${money(b.target_value)} / month`
                           : b.target_type === "fixed_yearly" ? `${money(b.target_value)} / year`
                           : `${money(b.target_value)} by ${b.target_deadline ?? "—"} (${monthsUntil(b.target_deadline)} mo left)`}
                        </span>
                      </div>
                      <span className="font-medium tabular-nums">{money(amount)}</span>
                    </div>
                    <Progress value={pct} />
                  </div>
                );
              })}
              <div className="pt-3 mt-3 border-t flex justify-between text-sm">
                <span className="text-muted-foreground">Unallocated</span>
                <span className={`tabular-nums font-medium ${unallocated < 0 ? "text-destructive" : ""}`}>
                  {money(unallocated)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <YearToDate buckets={data?.buckets ?? []} monthlyFn={monthly} firstSalaryAt={data?.firstSalaryAt ?? null} />
    </div>
  );
}

function YearToDate({ buckets, monthlyFn, firstSalaryAt }: { buckets: Bucket[]; monthlyFn: (b: Bucket) => number; firstSalaryAt: string | null }) {
  const now = new Date();
  const year = now.getFullYear();
  // Start of projection window: first salary (if this year) else Jan 1
  const start = firstSalaryAt && new Date(firstSalaryAt).getFullYear() === year
    ? new Date(firstSalaryAt)
    : new Date(year, 0, 1);
  // Fractional months elapsed since start (cap at 12)
  const msPerMonth = (365.25 / 12) * 86400000;
  const monthsElapsed = Math.max(0, Math.min(12, (now.getTime() - start.getTime()) / msPerMonth));
  // Months remaining until Dec 31 of this year
  const yearEndDate = new Date(year, 11, 31, 23, 59, 59);
  const monthsInYear = Math.max(0, Math.min(12, (yearEndDate.getTime() - start.getTime()) / msPerMonth));
  const startLabel = start.toLocaleDateString("en-GB");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PiggyBank className="size-5" /> Year-to-date projection</CardTitle>
        <CardDescription>
          Counted from {startLabel} ({firstSalaryAt && new Date(firstSalaryAt).getFullYear() === year ? "first salary" : "Jan 1"}). If current allocations continue, here's what each bucket reaches by year end.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!buckets.length ? <p className="text-sm text-muted-foreground">—</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {buckets.map((b) => {
              const ytd = monthlyFn(b) * monthsElapsed;
              const yearEnd = monthlyFn(b) * monthsInYear;
              return (
                <div key={b.id} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="size-2.5 rounded-full" style={{ background: b.color ?? "var(--primary)" }} />
                    <span className="font-medium text-sm">{b.name}</span>
                  </div>
                  <p className="text-2xl font-display">{money(ytd)}</p>
                  <p className="text-xs text-muted-foreground">{money(yearEnd)} by year end</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/5" : ""}>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-2xl font-display mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
