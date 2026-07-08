import type * as React from "react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { AlertTriangle, Info, Lightbulb, CheckCircle2, ArrowRight, MessageSquare, X, Undo2 } from "lucide-react";

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
  householdId, baseline, income, surplus, variablePool, netSpent, daysLeft, avgDaily7,
}: Props) {
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
    } catch { /* ignore */ }
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
      const [{ data: buckets }, { data: incomes }, { data: fixed }, { data: variables }, { data: confirmations }, { count: expenseCount }] = await Promise.all([
        supabase.from("buckets").select("id, name, target_type, target_value, target_deadline").eq("household_id", householdId),
        supabase.from("incomes").select("id, source, monthly_amount").eq("household_id", householdId),
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
      chatPrompt: "I haven't set a baseline monthly budget yet. How should I decide on a reasonable baseline given my income and fixed costs?",
    });
  }
  if (!data.incomes.length) {
    tips.push({
      id: "no-income",
      severity: "critical",
      title: "Add your monthly income",
      detail: "Income powers surplus, salary detection and bucket allocations.",
      cta: { label: "Add income", to: "/settings" },
      chatPrompt: "I haven't recorded any income sources. What should I include and how do I estimate monthly amounts for variable income?",
    });
  }
  if (!data.buckets.length) {
    tips.push({
      id: "no-buckets",
      severity: "critical",
      title: "Create your first savings bucket",
      detail: "Buckets turn surplus into concrete goals (emergency fund, holiday, house…). The earlier the better.",
      cta: { label: "Create bucket", to: "/settings" },
      chatPrompt: "I have no savings buckets yet. Given my situation, which buckets should I create first and how much should I aim for in each?",
    });
  }

  // ---- Income concentration risk (single source) ----
  if (data.incomes.length === 1 && income > 0) {
    const only = data.incomes[0];
    tips.push({
      id: "single-income-source",
      severity: "warning",
      title: "All your income comes from a single source",
      detail: `"${only.source ?? "Your only income stream"}" covers 100% of household income (${money(income)}/mo). A job loss or reduction would eliminate all cash flow — building a larger emergency fund and diversifying income reduces this risk.`,
      chatPrompt: "My household depends on a single income source. What's a reasonable emergency fund target for that situation, and what are realistic ways for a family of four in Portugal to diversify income?",
    });
  } else if (data.incomes.length > 1 && income > 0) {
    const sorted = [...data.incomes].sort((a, b) => Number(b.monthly_amount) - Number(a.monthly_amount));
    const top = Number(sorted[0].monthly_amount);
    if (top / income >= 0.8) {
      tips.push({
        id: "income-concentration",
        severity: "info",
        title: "Income is concentrated in one source",
        detail: `"${sorted[0].source ?? "Your largest income"}" accounts for ${Math.round((top / income) * 100)}% of household income. Losing it would leave only ${money(income - top)}/mo.`,
        chatPrompt: "Most of my household income comes from a single source. How exposed am I, and what should I do to reduce that risk?",
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
        title: `Savings rate is only ${Math.round(rate * 100)}%`,
        detail: `You save ${money(surplus)} out of ${money(income)}/mo. A common target is 15–20% — small baseline cuts or income growth compound over time.`,
        chatPrompt: `My household savings rate is about ${Math.round(rate * 100)}% of income. How can I realistically raise it without cutting essential spending?`,
      });
    }
  } else if (income > 0 && surplus <= 0) {
    tips.push({
      id: "negative-surplus",
      severity: "critical",
      title: "Your baseline leaves no surplus",
      detail: `Baseline (${money(baseline)}) meets or exceeds income (${money(income)}). Nothing is being saved — this is unsustainable.`,
      cta: { label: "Review baseline", to: "/settings" },
      chatPrompt: "My baseline budget leaves me with no surplus each month. Where should I look first to bring spending down?",
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
      chatPrompt: `My bucket targets add up to ${money(totalAllocated)} but my surplus is only ${money(surplus)}. Which buckets should I trim first?`,
    });
  } else if (data.buckets.length && surplus > 0 && unallocated > Math.max(50, surplus * 0.1)) {
    tips.push({
      id: "unallocated-surplus",
      severity: "warning",
      title: `${money(unallocated)} of surplus is unallocated`,
      detail: "Assign it to an existing bucket or create a new one — idle surplus tends to leak into everyday spending.",
      cta: { label: "Allocate", to: "/allocations" },
      chatPrompt: `I have ${money(unallocated)} of unallocated monthly surplus. What are good uses for it given my current buckets and goals?`,
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
  if (baseline > 0 && data.variables.length && variablePool > 0) {
    const projectedMonthly = avgDaily7 * 30;
    if (variableEstTotal > 0 && projectedMonthly > variableEstTotal * 1.3 && projectedMonthly - variableEstTotal > 50) {
      tips.push({
        id: "estimates-too-low",
        severity: "warning",
        title: "Your variable estimates look too low",
        detail: `You're spending ~${money(projectedMonthly)}/month at the current pace but planned only ${money(variableEstTotal)}. Increase the estimate or tighten spending.`,
        cta: { label: "Review estimates", to: "/settings" },
        chatPrompt: `My variable spending pace (${money(projectedMonthly)}/mo) is much higher than my planned estimate (${money(variableEstTotal)}/mo). Which categories usually drive that gap and how do I close it?`,
      });
    } else if (variableEstTotal > 0 && variableEstTotal > projectedMonthly * 1.5 && data.expenseCount > 10 && variableEstTotal - projectedMonthly > 100) {
      tips.push({
        id: "estimates-too-high",
        severity: "info",
        title: "Your variable estimates may be too high",
        detail: `Planned ${money(variableEstTotal)}/month but actual pace is only ${money(projectedMonthly)}. You may be able to redirect the difference into a bucket.`,
        cta: { label: "Adjust estimates", to: "/settings" },
        chatPrompt: `I've been consistently spending less than my variable estimate. Should I lower the estimate or redirect the difference into a specific bucket?`,
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
        chatPrompt: `I'm on pace to overspend my variable pool by about ${money(projected - variablePool)} this cycle. What are the fastest levers to slow down without hurting the family?`,
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
        title: "No dedicated emergency fund",
        detail: `You don't have a bucket earmarked for emergencies. Renaming or repurposing an existing bucket (not adding new money) gives that safety net a clear home — a common target is 3–6× monthly baseline (${money(baseline * 3)}–${money(baseline * 6)}).`,
        cta: { label: "Manage buckets", to: "/settings" },
        chatPrompt: `I don't have a dedicated emergency fund bucket. How large should it be for a family of four in Portugal, and how should I fund it without hurting my other goals?`,
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
        chatPrompt: `My goal "${b.name}" is due in ${m} month${m === 1 ? "" : "s"}. Is it still realistic given my surplus, and what should I do if it isn't?`,
      });
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
              {tips.length === 0 ? "All good — no issues detected" : "All tips acknowledged this cycle"}
            </p>
            <p className="text-sm text-muted-foreground">
              {tips.length === 0
                ? "Your budget, buckets and pace look healthy this cycle."
                : `${hidden.length} tip${hidden.length === 1 ? "" : "s"} dismissed until next cycle.`}
            </p>
          </div>
          {hidden.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setShowDismissed((s) => !s)}>
              {showDismissed ? "Hide" : "Show"} dismissed
            </Button>
          )}
        </CardContent>
        {showDismissed && hidden.length > 0 && (
          <CardContent className="space-y-2 pt-0">
            {hidden.map((t) => (
              <TipRow key={t.id} tip={t} dismissed onRestore={() => restore(t.id)} onChat={openChat} />
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
          <Lightbulb className="size-5" /> Issues &amp; tips
          <span className="text-xs font-normal text-muted-foreground">({active.length})</span>
        </CardTitle>
        <CardDescription>
          Rule-based suggestions computed from your data. Use <span className="font-medium">Chat</span> to explore any of them with the AI coach, or <span className="font-medium">Dismiss</span> to hide it for this cycle.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {active.map((t) => (
          <TipRow key={t.id} tip={t} onDismiss={() => dismiss(t.id)} onChat={openChat} />
        ))}
        {hidden.length > 0 && (
          <div className="pt-2 flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => setShowDismissed((s) => !s)}>
              {showDismissed ? "Hide" : `Show ${hidden.length} dismissed`}
            </Button>
          </div>
        )}
        {showDismissed && hidden.map((t) => (
          <TipRow key={`d-${t.id}`} tip={t} dismissed onRestore={() => restore(t.id)} onChat={openChat} />
        ))}
      </CardContent>
    </Card>
  );
}

function TipRow({
  tip, dismissed, onDismiss, onRestore, onChat,
}: {
  tip: Tip;
  dismissed?: boolean;
  onDismiss?: () => void;
  onRestore?: () => void;
  onChat?: (prompt: string) => void;
}) {
  const styles: Record<Severity, { border: string; bg: string; icon: React.ReactNode; iconWrap: string }> = {
    critical: { border: "border-destructive/40", bg: "bg-destructive/5", icon: <AlertTriangle className="size-4" />, iconWrap: "text-destructive" },
    warning: { border: "border-amber-500/40", bg: "bg-amber-500/5", icon: <AlertTriangle className="size-4" />, iconWrap: "text-amber-600 dark:text-amber-400" },
    info: { border: "border-sky-500/30", bg: "bg-sky-500/5", icon: <Info className="size-4" />, iconWrap: "text-sky-600 dark:text-sky-400" },
    success: { border: "border-emerald-500/30", bg: "bg-emerald-500/5", icon: <CheckCircle2 className="size-4" />, iconWrap: "text-emerald-600 dark:text-emerald-400" },
  };
  const s = styles[tip.severity];
  return (
    <div className={`flex items-start gap-3 rounded-lg border ${s.border} ${s.bg} p-3 ${dismissed ? "opacity-60" : ""}`}>
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
              <MessageSquare className="size-3" /> Chat
            </Button>
          )}
          {!dismissed && onDismiss && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onDismiss}>
              <X className="size-3" /> Dismiss
            </Button>
          )}
          {dismissed && onRestore && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onRestore}>
              <Undo2 className="size-3" /> Restore
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
