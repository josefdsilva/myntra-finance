import type * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { AlertTriangle, Info, Lightbulb, CheckCircle2, ArrowRight } from "lucide-react";

type Severity = "critical" | "warning" | "info" | "success";

type Tip = {
  id: string;
  severity: Severity;
  title: string;
  detail?: string;
  cta?: { label: string; to: string };
};

type Props = {
  householdId: string;
  baseline: number;
  income: number;
  surplus: number;
  variablePool: number;
  netSpent: number;
  daysLeft: number;
  avgDaily7: number;
};

export function DashboardTips({
  householdId, baseline, income, surplus, variablePool, netSpent, daysLeft, avgDaily7,
}: Props) {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const { data } = useQuery({
    queryKey: ["dashboard-tips", householdId, period],
    queryFn: async () => {
      const [{ data: buckets }, { data: incomes }, { data: fixed }, { data: variables }, { data: confirmations }, { count: expenseCount }] = await Promise.all([
        supabase.from("buckets").select("id, name, target_type, target_value, target_deadline").eq("household_id", householdId),
        supabase.from("incomes").select("id, monthly_amount").eq("household_id", householdId),
        supabase.from("fixed_expenses").select("id, monthly_amount").eq("household_id", householdId),
        supabase.from("variable_estimates").select("id, monthly_amount").eq("household_id", householdId),
        supabase.from("bucket_allocations").select("bucket_id, amount").eq("household_id", householdId).eq("period", period),
        supabase.from("expenses").select("id", { count: "exact", head: true }).eq("household_id", householdId).eq("kind", "expense"),
      ]);
      return {
        buckets: buckets ?? [],
        incomes: incomes ?? [],
        fixed: fixed ?? [],
        variables: variables ?? [],
        confirmations: confirmations ?? [],
        expenseCount: expenseCount ?? 0,
      };
    },
  });

  if (!data) return null;

  const tips: Tip[] = [];

  // ---- Setup gaps (critical) ----
  if (baseline <= 0) {
    tips.push({
      id: "no-baseline",
      severity: "critical",
      title: "Set your monthly baseline budget",
      detail: "Without a baseline we can't compute your safe-to-spend or surplus.",
      cta: { label: "Open settings", to: "/settings" },
    });
  }
  if (!data.incomes.length) {
    tips.push({
      id: "no-income",
      severity: "critical",
      title: "Add your monthly income",
      detail: "Income powers surplus, salary detection and bucket allocations.",
      cta: { label: "Add income", to: "/settings" },
    });
  }
  if (!data.buckets.length) {
    tips.push({
      id: "no-buckets",
      severity: "critical",
      title: "Create your first savings bucket",
      detail: "Buckets turn surplus into concrete goals (emergency fund, holiday, house…). The earlier the better.",
      cta: { label: "Create bucket", to: "/settings" },
    });
  }

  // ---- Allocation health ----
  function monthsUntil(dateStr: string | null): number {
    if (!dateStr) return 1;
    const t = new Date(dateStr);
    const m = (t.getFullYear() - now.getFullYear()) * 12 + (t.getMonth() - now.getMonth()) + (t.getDate() >= now.getDate() ? 0 : -1) + 1;
    return Math.max(1, m);
  }
  const totalAllocated = data.buckets.reduce((s, b) => {
    const v = Number(b.target_value);
    if (b.target_type === "pct_surplus") return s + (surplus * v) / 100;
    if (b.target_type === "fixed_monthly") return s + v;
    if (b.target_type === "fixed_yearly") return s + v / 12;
    return s + v / monthsUntil(b.target_deadline);
  }, 0);
  const unallocated = surplus - totalAllocated;

  if (data.buckets.length && surplus > 0 && totalAllocated > surplus + 0.5) {
    tips.push({
      id: "over-allocated",
      severity: "warning",
      title: `Bucket targets exceed surplus by ${money(totalAllocated - surplus)}`,
      detail: "Your monthly bucket targets add up to more than your surplus. Rebalance the targets or increase your baseline gap.",
      cta: { label: "Rebalance", to: "/allocations" },
    });
  } else if (data.buckets.length && surplus > 0 && unallocated > Math.max(50, surplus * 0.1)) {
    tips.push({
      id: "unallocated-surplus",
      severity: "warning",
      title: `${money(unallocated)} of surplus is unallocated`,
      detail: "Assign it to an existing bucket or create a new one — idle surplus tends to leak into everyday spending.",
      cta: { label: "Allocate", to: "/allocations" },
    });
  }

  // ---- Cycle confirmations near month end ----
  const daysToMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const unconfirmed = data.buckets.filter((b) => !data.confirmations.some((c) => c.bucket_id === b.id));
  if (data.buckets.length && daysToMonthEnd <= 7 && unconfirmed.length) {
    tips.push({
      id: "confirm-allocations",
      severity: "warning",
      title: `Confirm this month's allocations (${unconfirmed.length} pending)`,
      detail: `Month ends in ${daysToMonthEnd} day${daysToMonthEnd === 1 ? "" : "s"} — lock in ${unconfirmed.map((b) => b.name).slice(0, 3).join(", ")}${unconfirmed.length > 3 ? "…" : ""}.`,
      cta: { label: "Go to allocations", to: "/allocations" },
    });
  }

  // ---- Fixed expenses missing ----
  if (baseline > 0 && !data.fixed.length && data.expenseCount > 5) {
    tips.push({
      id: "no-fixed",
      severity: "info",
      title: "Track your fixed expenses",
      detail: "Recording rent, utilities and subscriptions makes the baseline realistic and the burndown chart accurate.",
      cta: { label: "Add fixed expenses", to: "/settings" },
    });
  }

  // ---- Variable estimates realism ----
  const variableEstTotal = data.variables.reduce((s, r) => s + Number(r.monthly_amount), 0);
  const variablePoolMonthly = variablePool; // already excludes fixed
  if (baseline > 0 && data.variables.length && variablePoolMonthly > 0) {
    const projectedMonthly = avgDaily7 * 30; // rough monthly pace
    if (variableEstTotal > 0 && projectedMonthly > variableEstTotal * 1.3 && projectedMonthly - variableEstTotal > 50) {
      tips.push({
        id: "estimates-too-low",
        severity: "warning",
        title: "Your variable estimates look too low",
        detail: `You're spending ~${money(projectedMonthly)}/month at the current pace but planned only ${money(variableEstTotal)}. Increase the estimate or tighten spending.`,
        cta: { label: "Review estimates", to: "/settings" },
      });
    } else if (variableEstTotal > 0 && variableEstTotal > projectedMonthly * 1.5 && data.expenseCount > 10 && variableEstTotal - projectedMonthly > 100) {
      tips.push({
        id: "estimates-too-high",
        severity: "info",
        title: "Your variable estimates may be too high",
        detail: `Planned ${money(variableEstTotal)}/month but actual pace is only ${money(projectedMonthly)}. You may be able to redirect the difference into a bucket.`,
        cta: { label: "Adjust estimates", to: "/settings" },
      });
    }
  } else if (baseline > 0 && !data.variables.length && data.expenseCount > 5) {
    tips.push({
      id: "no-variable-estimates",
      severity: "info",
      title: "Add variable expense estimates",
      detail: "Estimating groceries, transport, etc. sharpens your baseline and improves the analysis view.",
      cta: { label: "Add estimates", to: "/settings" },
    });
  }

  // ---- Cycle pace projection ----
  if (variablePool > 0 && avgDaily7 > 0) {
    const projected = netSpent + avgDaily7 * daysLeft;
    if (projected > variablePool * 1.05) {
      tips.push({
        id: "overpace",
        severity: "warning",
        title: `On pace to overspend by ${money(projected - variablePool)} this cycle`,
        detail: `At ${money(avgDaily7)}/day average, you'll end the cycle over budget. Slow down or top up from surplus.`,
      });
    }
  }

  // ---- Emergency pool ----
  if (baseline > 0 && data.buckets.length) {
    const emergency = Math.max(0, surplus - totalAllocated);
    if (emergency < baseline * 0.5 && surplus > 0) {
      tips.push({
        id: "thin-emergency",
        severity: "info",
        title: "Emergency buffer is thin",
        detail: `Unallocated surplus of ${money(emergency)} is less than half a month of baseline (${money(baseline)}). Consider a dedicated emergency bucket.`,
        cta: { label: "Add bucket", to: "/settings" },
      });
    }
  }

  // ---- Goal deadlines slipping ----
  for (const b of data.buckets) {
    if (b.target_type !== "goal_by_date") continue;
    const m = monthsUntil(b.target_deadline);
    if (m <= 2) {
      tips.push({
        id: `goal-close-${b.id}`,
        severity: "info",
        title: `Goal "${b.name}" deadline is close`,
        detail: `${m} month${m === 1 ? "" : "s"} left — check whether the target is reachable.`,
        cta: { label: "Review", to: "/allocations" },
      });
    }
  }

  if (!tips.length) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="pt-6 flex items-start gap-3">
          <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">All good — no issues detected</p>
            <p className="text-sm text-muted-foreground">Your budget, buckets and pace look healthy this cycle.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const rank: Record<Severity, number> = { critical: 0, warning: 1, info: 2, success: 3 };
  tips.sort((a, b) => rank[a.severity] - rank[b.severity]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="size-5" /> Issues &amp; tips
          <span className="text-xs font-normal text-muted-foreground">({tips.length})</span>
        </CardTitle>
        <CardDescription>Prioritized suggestions to keep your budget on track.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {tips.map((t) => (
          <TipRow key={t.id} tip={t} />
        ))}
      </CardContent>
    </Card>
  );
}

function TipRow({ tip }: { tip: Tip }) {
  const styles: Record<Severity, { border: string; bg: string; icon: React.ReactNode; iconWrap: string }> = {
    critical: {
      border: "border-destructive/40",
      bg: "bg-destructive/5",
      icon: <AlertTriangle className="size-4" />,
      iconWrap: "text-destructive",
    },
    warning: {
      border: "border-amber-500/40",
      bg: "bg-amber-500/5",
      icon: <AlertTriangle className="size-4" />,
      iconWrap: "text-amber-600 dark:text-amber-400",
    },
    info: {
      border: "border-sky-500/30",
      bg: "bg-sky-500/5",
      icon: <Info className="size-4" />,
      iconWrap: "text-sky-600 dark:text-sky-400",
    },
    success: {
      border: "border-emerald-500/30",
      bg: "bg-emerald-500/5",
      icon: <CheckCircle2 className="size-4" />,
      iconWrap: "text-emerald-600 dark:text-emerald-400",
    },
  };
  const s = styles[tip.severity];
  return (
    <div className={`flex items-start gap-3 rounded-lg border ${s.border} ${s.bg} p-3`}>
      <div className={`mt-0.5 shrink-0 ${s.iconWrap}`}>{s.icon}</div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">{tip.title}</p>
        {tip.detail && <p className="text-xs text-muted-foreground mt-0.5">{tip.detail}</p>}
      </div>
      {tip.cta && (
        <Button asChild size="sm" variant="ghost" className="shrink-0">
          <Link to={tip.cta.to}>
            {tip.cta.label} <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      )}
    </div>
  );
}
