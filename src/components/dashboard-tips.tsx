import type * as React from "react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";
import {
  AlertTriangle,
  Info,
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  MessageSquare,
  X,
  Undo2,
} from "lucide-react";

type Severity = "critical" | "warning" | "info" | "success";

type Tip = {
  id: string;
  severity: Severity;
  title: string;
  detail?: string;
  cta?: { label: string; to: string };
  /** Prefilled question to send to the AI coach when the user clicks "Chat". */
  chatPrompt?: string;
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

const EMERGENCY_HINTS = ["emergency", "buffer", "safety", "rainy", "reserve"];

export function DashboardTips({
  householdId,
  baseline,
  income,
  surplus,
  variablePool,
  netSpent,
  daysLeft,
  avgDaily7,
}: Props) {
  const t = useT();
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const navigate = useNavigate();

  // Dismissed tips are stored per household+period in localStorage.
  const storageKey = `dashboard-tips-dismissed:${householdId}:${period}`;
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [showDismissed, setShowDismissed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setDismissed(new Set(JSON.parse(raw)));
      else setDismissed(new Set());
    } catch {
      setDismissed(new Set());
    }
  }, [storageKey]);

  function persist(next: Set<string>) {
    setDismissed(new Set(next));
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
    } catch {
      /* ignore */
    }
  }
  function dismiss(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    persist(next);
  }
  function restore(id: string) {
    const next = new Set(dismissed);
    next.delete(id);
    persist(next);
  }

  const { data } = useQuery({
    queryKey: ["dashboard-tips", householdId, period],
    queryFn: async () => {
      const [
        { data: buckets },
        { data: incomes },
        { data: fixed },
        { data: debts },
        { data: variables },
        { data: confirmations },
        { data: allTimeAllocations },
        { count: expenseCount },
      ] = await Promise.all([
        supabase
          .from("buckets")
          .select("id, name, target_type, target_value, target_deadline, initial_balance")
          .eq("household_id", householdId),
        supabase
          .from("incomes")
          .select("id, label, monthly_amount")
          .eq("household_id", householdId),
        supabase
          .from("fixed_expenses")
          .select("id, monthly_amount")
          .eq("household_id", householdId),
        supabase.from("debts").select("id, monthly_amount").eq("household_id", householdId),
        supabase
          .from("variable_estimates")
          .select("id, monthly_amount")
          .eq("household_id", householdId),
        supabase
          .from("bucket_allocations")
          .select("bucket_id, amount")
          .eq("household_id", householdId)
          .eq("period", period),
        // All-time confirmed contributions per bucket (not just this period) — needed to
        // know a goal bucket's real current balance for the feasibility checks below.
        supabase
          .from("bucket_allocations")
          .select("bucket_id, amount")
          .eq("household_id", householdId),
        supabase
          .from("expenses")
          .select("id", { count: "exact", head: true })
          .eq("household_id", householdId)
          .eq("kind", "expense"),
      ]);
      const allTimeTotals: Record<string, number> = {};
      for (const r of allTimeAllocations ?? []) {
        allTimeTotals[r.bucket_id] = (allTimeTotals[r.bucket_id] ?? 0) + Number(r.amount);
      }
      return {
        buckets: buckets ?? [],
        incomes: incomes ?? [],
        fixed: [...(fixed ?? []), ...(debts ?? [])],
        variables: variables ?? [],
        confirmations: confirmations ?? [],
        allTimeTotals,
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
      title: t("tips.noBaseline.title"),
      detail: t("tips.noBaseline.detail"),
      cta: { label: t("tips.cta.openSettings"), to: "/settings" },
      chatPrompt: t("tips.noBaseline.chat"),
    });
  }
  if (!data.incomes.length) {
    tips.push({
      id: "no-income",
      severity: "critical",
      title: t("tips.noIncome.title"),
      detail: t("tips.noIncome.detail"),
      cta: { label: t("tips.cta.addIncome"), to: "/settings" },
      chatPrompt: t("tips.noIncome.chat"),
    });
  }
  if (!data.buckets.length) {
    tips.push({
      id: "no-buckets",
      severity: "critical",
      title: t("tips.noBuckets.title"),
      detail: t("tips.noBuckets.detail"),
      cta: { label: t("tips.cta.createBucket"), to: "/settings" },
      chatPrompt: t("tips.noBuckets.chat"),
    });
  }

  // ---- Income concentration risk (single source) ----
  if (data.incomes.length === 1 && income > 0) {
    const only = data.incomes[0];
    tips.push({
      id: "single-income-source",
      severity: "warning",
      title: t("tips.singleIncome.title"),
      detail: t("tips.singleIncome.detail", {
        label: only.label ?? t("tips.singleIncome.fallbackLabel"),
        income: money(income),
      }),
      chatPrompt: t("tips.singleIncome.chat"),
    });
  } else if (data.incomes.length > 1 && income > 0) {
    const sorted = [...data.incomes].sort(
      (a, b) => Number(b.monthly_amount) - Number(a.monthly_amount),
    );
    const top = Number(sorted[0].monthly_amount);
    if (top / income >= 0.8) {
      tips.push({
        id: "income-concentration",
        severity: "info",
        title: t("tips.incomeConcentration.title"),
        detail: t("tips.incomeConcentration.detail", {
          label: sorted[0].label ?? t("tips.incomeConcentration.fallbackLabel"),
          pct: Math.round((top / income) * 100),
          remaining: money(income - top),
        }),
        chatPrompt: t("tips.incomeConcentration.chat"),
      });
    }
  }

  // ---- Savings rate ----
  if (income > 0 && surplus > 0) {
    const rate = surplus / income;
    if (rate < 0.1) {
      tips.push({
        id: "low-savings-rate",
        severity: "warning",
        title: t("tips.lowSavingsRate.title", { pct: Math.round(rate * 100) }),
        detail: t("tips.lowSavingsRate.detail", { surplus: money(surplus), income: money(income) }),
        chatPrompt: t("tips.lowSavingsRate.chat", { pct: Math.round(rate * 100) }),
      });
    }
  } else if (income > 0 && surplus <= 0) {
    tips.push({
      id: "negative-surplus",
      severity: "critical",
      title: t("tips.negativeSurplus.title"),
      detail: t("tips.negativeSurplus.detail", {
        baseline: money(baseline),
        income: money(income),
      }),
      cta: { label: t("tips.cta.reviewBaseline"), to: "/settings" },
      chatPrompt: t("tips.negativeSurplus.chat"),
    });
  }

  // ---- Allocation health ----
  function monthsUntil(dateStr: string | null): number {
    if (!dateStr) return 1;
    const t = new Date(dateStr);
    const m =
      (t.getFullYear() - now.getFullYear()) * 12 +
      (t.getMonth() - now.getMonth()) +
      (t.getDate() >= now.getDate() ? 0 : -1) +
      1;
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
      title: t("tips.overAllocated.title", { excess: money(totalAllocated - surplus) }),
      detail: t("tips.overAllocated.detail"),
      cta: { label: t("tips.cta.rebalance"), to: "/allocations" },
      chatPrompt: t("tips.overAllocated.chat", {
        allocated: money(totalAllocated),
        surplus: money(surplus),
      }),
    });
  } else if (data.buckets.length && surplus > 0 && unallocated > Math.max(50, surplus * 0.1)) {
    tips.push({
      id: "unallocated-surplus",
      severity: "warning",
      title: t("tips.unallocatedSurplus.title", { value: money(unallocated) }),
      detail: t("tips.unallocatedSurplus.detail"),
      cta: { label: t("tips.cta.allocate"), to: "/allocations" },
      chatPrompt: t("tips.unallocatedSurplus.chat", { value: money(unallocated) }),
    });
  }

  // ---- Cycle confirmations near month end ----
  const daysToMonthEnd =
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const unconfirmed = data.buckets.filter(
    (b) => !data.confirmations.some((c) => c.bucket_id === b.id),
  );
  if (data.buckets.length && daysToMonthEnd <= 7 && unconfirmed.length) {
    tips.push({
      id: "confirm-allocations",
      severity: "warning",
      title: t("tips.confirmAllocations.title", { count: unconfirmed.length }),
      detail: t("tips.confirmAllocations.detail", {
        days: daysToMonthEnd,
        names: `${unconfirmed
          .map((b) => b.name)
          .slice(0, 3)
          .join(", ")}${unconfirmed.length > 3 ? "…" : ""}`,
      }),
      cta: { label: t("tips.cta.goToAllocations"), to: "/allocations" },
    });
  }

  // ---- Fixed expenses missing ----
  if (baseline > 0 && !data.fixed.length && data.expenseCount > 5) {
    tips.push({
      id: "no-fixed",
      severity: "info",
      title: t("tips.noFixed.title"),
      detail: t("tips.noFixed.detail"),
      cta: { label: t("tips.cta.addFixedExpenses"), to: "/settings" },
    });
  }

  // ---- Variable estimates realism ----
  const variableEstTotal = data.variables.reduce((s, r) => s + Number(r.monthly_amount), 0);
  if (baseline > 0 && data.variables.length && variablePool > 0) {
    const projectedMonthly = avgDaily7 * 30;
    if (
      variableEstTotal > 0 &&
      projectedMonthly > variableEstTotal * 1.3 &&
      projectedMonthly - variableEstTotal > 50
    ) {
      tips.push({
        id: "estimates-too-low",
        severity: "warning",
        title: t("tips.estimatesTooLow.title"),
        detail: t("tips.estimatesTooLow.detail", {
          pace: money(projectedMonthly),
          planned: money(variableEstTotal),
        }),
        cta: { label: t("tips.cta.reviewEstimates"), to: "/settings" },
        chatPrompt: t("tips.estimatesTooLow.chat", {
          pace: money(projectedMonthly),
          planned: money(variableEstTotal),
        }),
      });
    } else if (
      variableEstTotal > 0 &&
      variableEstTotal > projectedMonthly * 1.5 &&
      data.expenseCount > 10 &&
      variableEstTotal - projectedMonthly > 100
    ) {
      tips.push({
        id: "estimates-too-high",
        severity: "info",
        title: t("tips.estimatesTooHigh.title"),
        detail: t("tips.estimatesTooHigh.detail", {
          planned: money(variableEstTotal),
          actual: money(projectedMonthly),
        }),
        cta: { label: t("tips.cta.adjustEstimates"), to: "/settings" },
        chatPrompt: t("tips.estimatesTooHigh.chat"),
      });
    }
  } else if (baseline > 0 && !data.variables.length && data.expenseCount > 5) {
    tips.push({
      id: "no-variable-estimates",
      severity: "info",
      title: t("tips.noVariableEstimates.title"),
      detail: t("tips.noVariableEstimates.detail"),
      cta: { label: t("tips.cta.addEstimates"), to: "/settings" },
    });
  }

  // ---- Cycle pace projection ----
  if (variablePool > 0 && avgDaily7 > 0) {
    const projected = netSpent + avgDaily7 * daysLeft;
    if (projected > variablePool * 1.05) {
      tips.push({
        id: "overpace",
        severity: "warning",
        title: t("tips.overpace.title", { value: money(projected - variablePool) }),
        detail: t("tips.overpace.detail", { avgDaily: money(avgDaily7) }),
        chatPrompt: t("tips.overpace.chat", { value: money(projected - variablePool) }),
      });
    }
  }

  // ---- Emergency bucket coverage (framed correctly) ----
  if (baseline > 0 && data.buckets.length) {
    const hasEmergency = data.buckets.some((b) =>
      EMERGENCY_HINTS.some((h) => b.name.toLowerCase().includes(h)),
    );
    if (!hasEmergency && surplus > 0) {
      tips.push({
        id: "no-emergency-bucket",
        severity: "info",
        title: t("tips.noEmergency.title"),
        detail: t("tips.noEmergency.detail", {
          low: money(baseline * 3),
          high: money(baseline * 6),
        }),
        cta: { label: t("tips.cta.manageBuckets"), to: "/settings" },
        chatPrompt: t("tips.noEmergency.chat"),
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
        title: t("tips.goalClose.title", { name: b.name }),
        detail: t("tips.goalClose.detail", { months: m }),
        cta: { label: t("tips.cta.review"), to: "/allocations" },
        chatPrompt: t("tips.goalClose.chat", { name: b.name, months: m }),
      });
    }
  }

  // ---- Goal feasibility: too optimistic vs. under-challenging ----
  // Forward-looking, not pace-history-based: given what's already saved (initial balance +
  // every confirmed contribution to date) and the time left, is the monthly amount required
  // to still hit the target in line with what the household can actually put aside?
  if (surplus > 0) {
    for (const b of data.buckets) {
      if (b.target_type !== "goal_by_date") continue;
      const target = Number(b.target_value);
      const currentBalance = Number(b.initial_balance ?? 0) + (data.allTimeTotals[b.id] ?? 0);
      const remaining = target - currentBalance;
      if (remaining <= 0) continue; // already funded
      const monthsLeft = monthsUntil(b.target_deadline);
      const requiredMonthly = remaining / monthsLeft;
      const ratio = requiredMonthly / surplus;

      if (ratio > 0.75) {
        tips.push({
          id: `goal-unrealistic-${b.id}`,
          severity: "warning",
          title: t("tips.goalUnrealistic.title", { name: b.name }),
          detail: t("tips.goalUnrealistic.detail", {
            date: b.target_deadline ?? "",
            required: money(requiredMonthly),
            pct: Math.round(ratio * 100),
            surplus: money(surplus),
          }),
          cta: { label: t("tips.cta.adjustGoal"), to: "/settings" },
          chatPrompt: t("tips.goalUnrealistic.chat", {
            name: b.name,
            required: money(requiredMonthly),
            target: money(target),
            date: b.target_deadline ?? "",
            pct: Math.round(ratio * 100),
            surplus: money(surplus),
          }),
        });
      } else if (ratio < 0.15 && monthsLeft >= 3) {
        tips.push({
          id: `goal-too-easy-${b.id}`,
          severity: "info",
          title: t("tips.goalTooEasy.title", { name: b.name }),
          detail: t("tips.goalTooEasy.detail", {
            required: money(requiredMonthly),
            pct: Math.round(ratio * 100),
            target: money(target),
            date: b.target_deadline ?? "",
            months: monthsLeft,
          }),
          cta: { label: t("tips.cta.adjustGoal"), to: "/settings" },
          chatPrompt: t("tips.goalTooEasy.chat", {
            name: b.name,
            required: money(requiredMonthly),
            pct: Math.round(ratio * 100),
            target: money(target),
            date: b.target_deadline ?? "",
          }),
        });
      }
    }
  }

  const rank: Record<Severity, number> = { critical: 0, warning: 1, info: 2, success: 3 };
  tips.sort((a, b) => rank[a.severity] - rank[b.severity]);

  const active = tips.filter((t) => !dismissed.has(t.id));
  const hidden = tips.filter((t) => dismissed.has(t.id));

  function openChat(prompt: string) {
    navigate({ to: "/analysis", search: { ask: prompt } as never });
  }

  if (!active.length) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="pt-6 flex items-start gap-3">
          <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">
              {tips.length === 0 ? t("tips.allGood") : t("tips.allAcknowledged")}
            </p>
            <p className="text-sm text-muted-foreground">
              {tips.length === 0
                ? t("tips.healthyBody")
                : t("tips.dismissedUntilNext", { count: hidden.length })}
            </p>
          </div>
          {hidden.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setShowDismissed((s) => !s)}>
              {showDismissed ? t("tips.hideDismissed") : t("tips.showDismissed")}
            </Button>
          )}
        </CardContent>
        {showDismissed && hidden.length > 0 && (
          <CardContent className="space-y-2 pt-0">
            {hidden.map((tip) => (
              <TipRow
                key={tip.id}
                tip={tip}
                dismissed
                onRestore={() => restore(tip.id)}
                onChat={openChat}
              />
            ))}
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="size-5" /> {t("tips.title")}
          <span className="text-xs font-normal text-muted-foreground">({active.length})</span>
        </CardTitle>
        <CardDescription>
          {t("tips.description", { chat: t("tips.chatButton"), dismiss: t("tips.dismissButton") })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {active.map((tip) => (
          <TipRow key={tip.id} tip={tip} onDismiss={() => dismiss(tip.id)} onChat={openChat} />
        ))}
        {hidden.length > 0 && (
          <div className="pt-2 flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => setShowDismissed((s) => !s)}>
              {showDismissed
                ? t("tips.hideDismissed")
                : t("tips.showCountDismissed", { count: hidden.length })}
            </Button>
          </div>
        )}
        {showDismissed &&
          hidden.map((tip) => (
            <TipRow
              key={`d-${tip.id}`}
              tip={tip}
              dismissed
              onRestore={() => restore(tip.id)}
              onChat={openChat}
            />
          ))}
      </CardContent>
    </Card>
  );
}

function TipRow({
  tip,
  dismissed,
  onDismiss,
  onRestore,
  onChat,
}: {
  tip: Tip;
  dismissed?: boolean;
  onDismiss?: () => void;
  onRestore?: () => void;
  onChat?: (prompt: string) => void;
}) {
  const t = useT();
  const styles: Record<
    Severity,
    { border: string; bg: string; icon: React.ReactNode; iconWrap: string }
  > = {
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
    <div
      className={`flex items-start gap-3 rounded-lg border ${s.border} ${s.bg} p-3 ${dismissed ? "opacity-60" : ""}`}
    >
      <div className={`mt-0.5 shrink-0 ${s.iconWrap}`}>{s.icon}</div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">{tip.title}</p>
        {tip.detail && <p className="text-xs text-muted-foreground mt-0.5">{tip.detail}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tip.cta && !dismissed && (
            <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
              <a href={tip.cta.to}>
                {tip.cta.label} <ArrowRight className="size-3" />
              </a>
            </Button>
          )}
          {tip.chatPrompt && onChat && !dismissed && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => onChat(tip.chatPrompt!)}
            >
              <MessageSquare className="size-3" /> {t("tips.chatButton")}
            </Button>
          )}
          {!dismissed && onDismiss && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onDismiss}>
              <X className="size-3" /> {t("tips.dismissButton")}
            </Button>
          )}
          {dismissed && onRestore && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onRestore}>
              <Undo2 className="size-3" /> {t("tips.restoreButton")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
