import type * as React from "react";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  bucketsQuery,
  incomesQuery,
  fixedExpensesQuery,
  debtsQuery,
  variableEstimatesQuery,
} from "@/lib/household-queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { buildForecast, monthKey, type Plan } from "@/lib/plan";
import { liquidityForKind } from "@/lib/assets.functions";
import { resolveIntent, summariseIntent } from "@/lib/intent";
import { useT, type MessageKey } from "@/lib/i18n";
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
  isBusiness?: boolean;
  baseline: number;
  income: number;
  surplus: number;
  variablePool: number;
  netSpent: number;
  daysLeft: number;
  avgDaily7: number;
};

const EMERGENCY_HINTS = ["emergency", "buffer", "safety", "rainy", "reserve"];

const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" });

export function DashboardTips({
  householdId,
  isBusiness = false,
  baseline,
  income,
  surplus,
  variablePool,
  netSpent,
  daysLeft,
  avgDaily7,
}: Props) {
  const t = useT();
  // For business spaces, household-framed tips (surplus, savings rate, income
  // concentration, emergency fund, plan shortfall) swap to a `.biz` copy variant
  // that speaks in cashflow/runway/revenue terms instead.
  const bt = (key: string, vars?: Record<string, string | number>) =>
    t((isBusiness ? `${key}.biz` : key) as MessageKey, vars);
  const qc = useQueryClient();
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  

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
      // Base tables come from the shared cache (already fetched by the Dashboard
      // on this screen); only the allocation/expense counts are tips-specific.
      const since = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();
      const [
        buckets,
        incomes,
        fixed,
        debts,
        variables,
        { data: confirmations },
        { data: allTimeAllocations },
        { count: expenseCount },
        { data: plans },
        { data: assets },
        { data: recentExpenses },
      ] = await Promise.all([
        qc.fetchQuery(bucketsQuery(householdId)),
        qc.fetchQuery(incomesQuery(householdId)),
        qc.fetchQuery(fixedExpensesQuery(householdId)),
        qc.fetchQuery(debtsQuery(householdId)),
        qc.fetchQuery(variableEstimatesQuery(householdId)),
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
        supabase
          .from("plans")
          .select("id, label, amount, actual_amount, direction, month, recurrence, category, bucket_id, done")
          .eq("household_id", householdId),
        supabase
          .from("assets")
          .select("id, name, kind, current_value, updated_at")
          .eq("household_id", householdId),
        supabase
          .from("expenses")
          .select("amount, category, intent")
          .eq("household_id", householdId)
          .eq("kind", "expense")
          .gte("occurred_at", since),
      ]);
      const allTimeTotals: Record<string, number> = {};
      for (const r of allTimeAllocations ?? []) {
        allTimeTotals[r.bucket_id] = (allTimeTotals[r.bucket_id] ?? 0) + Number(r.amount);
      }
      return {
        buckets,
        incomes,
        fixed: [...fixed, ...debts],
        variables,
        confirmations: confirmations ?? [],
        allTimeTotals,
        expenseCount: expenseCount ?? 0,
        plans: (plans ?? []) as unknown as Plan[],
        assets: (assets ?? []) as Array<{
          id: string;
          name: string;
          kind: string;
          current_value: number | string;
          updated_at: string;
        }>,
        recentExpenses: (recentExpenses ?? []) as Array<{
          amount: number | string;
          category: string | null;
          intent: string | null;
        }>,
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
    // A pension or benefits stream is inherently more stable than a single
    // salary, so the diversification nudge is a gentler heads-up, not a warning.
    const stable = only.type === "pension" || only.type === "benefits";
    tips.push({
      id: "single-income-source",
      severity: stable ? "info" : "warning",
      title: bt("tips.singleIncome.title"),
      detail: bt("tips.singleIncome.detail", {
        label: only.label ?? bt("tips.singleIncome.fallbackLabel"),
        income: money(income),
      }),
      chatPrompt: bt("tips.singleIncome.chat"),
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
        title: bt("tips.incomeConcentration.title"),
        detail: bt("tips.incomeConcentration.detail", {
          label: sorted[0].label ?? bt("tips.incomeConcentration.fallbackLabel"),
          pct: Math.round((top / income) * 100),
          remaining: money(income - top),
        }),
        chatPrompt: bt("tips.incomeConcentration.chat"),
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
        title: bt("tips.lowSavingsRate.title", { pct: Math.round(rate * 100) }),
        detail: bt("tips.lowSavingsRate.detail", { surplus: money(surplus), income: money(income) }),
        chatPrompt: bt("tips.lowSavingsRate.chat", { pct: Math.round(rate * 100) }),
      });
    }
  } else if (income > 0 && surplus <= 0) {
    tips.push({
      id: "negative-surplus",
      severity: "critical",
      title: bt("tips.negativeSurplus.title"),
      detail: bt("tips.negativeSurplus.detail", {
        baseline: money(baseline),
        income: money(income),
      }),
      cta: { label: t("tips.cta.reviewBaseline"), to: "/settings" },
      chatPrompt: bt("tips.negativeSurplus.chat"),
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
    // Idle surplus: money beyond the everyday pool (which already includes the
    // spendable cushion) and beyond what any project needs. It's an opportunity,
    // not a problem — so it's an "info", and the personalised "what to do"
    // (extra debt payments vs emergency top-up vs investing, weighed by interest
    // rate and buffer) is handed to the coach rather than hard-coded here.
    tips.push({
      id: "unallocated-surplus",
      severity: "info",
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

  // ---- Project balances split by type (emergency / investment / savings) ----
  const balOf = (b: (typeof data.buckets)[number]) =>
    Number(b.initial_balance ?? 0) + (data.allTimeTotals[b.id] ?? 0);
  const kindOf = (b: (typeof data.buckets)[number]): "savings" | "emergency" | "investment" =>
    (b.kind as "savings" | "emergency" | "investment" | null) ?? "savings";
  let emergencyBal = 0;
  let investmentBal = 0;
  let savingsBal = 0;
  let hasEmergencyKind = false;
  let hasInvestmentKind = false;
  for (const b of data.buckets) {
    const bal = balOf(b);
    const k = kindOf(b);
    if (k === "emergency") {
      emergencyBal += bal;
      hasEmergencyKind = true;
    } else if (k === "investment") {
      investmentBal += bal;
      hasInvestmentKind = true;
    } else savingsBal += bal;
  }
  // Liquid reserve excludes investments (shouldn't be raided). Fall back to the
  // name heuristic only when no project is explicitly tagged as the emergency fund.
  const hasEmergency =
    hasEmergencyKind ||
    data.buckets.some((b) => EMERGENCY_HINTS.some((h) => b.name.toLowerCase().includes(h)));
  const liquidReserve = hasEmergencyKind ? emergencyBal : savingsBal + emergencyBal;
  const reserveMonths = baseline > 0 ? liquidReserve / baseline : 0;

  // ---- Emergency fund (framed correctly) ----
  if (baseline > 0 && data.buckets.length && surplus > 0) {
    if (!hasEmergency) {
      tips.push({
        id: "no-emergency-bucket",
        severity: "info",
        title: bt("tips.noEmergency.title"),
        detail: bt("tips.noEmergency.detail", {
          low: money(baseline * 3),
          high: money(baseline * 6),
        }),
        cta: { label: t("tips.cta.manageBuckets"), to: "/settings" },
        chatPrompt: bt("tips.noEmergency.chat"),
      });
    }
  }

  // ---- Investment balance vs. emergency-first priority ----
  if (baseline > 0 && surplus > 0) {
    if (hasInvestmentKind && investmentBal > 0 && reserveMonths < 3) {
      // Investing while the safety net is thin — suggest rebalancing.
      tips.push({
        id: "over-investing",
        severity: "warning",
        title: t("tips.overInvest.title"),
        detail: t("tips.overInvest.detail", {
          months: reserveMonths.toFixed(1),
          target: money(baseline * 3),
        }),
        cta: { label: t("tips.cta.manageBuckets"), to: "/settings" },
        chatPrompt: t("tips.overInvest.chat"),
      });
    } else if (hasEmergency && reserveMonths >= 3 && investmentBal <= liquidReserve * 0.25) {
      // Healthy cushion but little put to work — nudge toward investing the surplus.
      tips.push({
        id: "under-investing",
        severity: "info",
        title: t("tips.underInvest.title"),
        detail: t("tips.underInvest.detail", { surplus: money(surplus) }),
        cta: { label: t("tips.cta.manageBuckets"), to: "/settings" },
        chatPrompt: t("tips.underInvest.chat"),
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

  // ---- Forward plans (future costs & income changes) ----
  const planList = data.plans ?? [];
  if (planList.length && income > 0) {
    const forecast = buildForecast({ plans: planList, baseline, monthlyIncome: income, months: 6 });
    const firstShort = forecast.find((m) => m.shortfall);
    if (firstShort) {
      tips.push({
        id: `plan-shortfall-${firstShort.ym}`,
        severity: "warning",
        title: bt("tips.planShortfall.title", { month: monthLabel(firstShort.ym) }),
        detail: bt("tips.planShortfall.detail", { amount: money(-firstShort.leftover) }),
        cta: { label: t("tips.cta.openPlan"), to: "/plan" },
        chatPrompt: bt("tips.planShortfall.chat", { month: monthLabel(firstShort.ym) }),
      });
    }
    // A big unfunded one-off within 3 months that one month's leftover can't absorb.
    const nowYm = monthKey(now);
    const horizonYm = monthKey(new Date(now.getFullYear(), now.getMonth() + 3, 1));
    const bigUnfunded = planList
      .filter((p) => !p.done && p.direction === "spend" && !p.bucket_id)
      .filter((p) => {
        const ym = String(p.month).slice(0, 7);
        return ym >= nowYm && ym <= horizonYm;
      })
      .filter((p) => Math.abs(Number(p.amount) || 0) > Math.max(surplus, 0))
      .sort((a, b) => String(a.month).localeCompare(String(b.month)))[0];
    if (bigUnfunded) {
      tips.push({
        id: `plan-fund-${bigUnfunded.id}`,
        severity: "info",
        title: t("tips.planFund.title", { label: bigUnfunded.label }),
        detail: t("tips.planFund.detail", {
          amount: money(Math.abs(Number(bigUnfunded.amount) || 0)),
          month: monthLabel(String(bigUnfunded.month).slice(0, 7)),
        }),
        cta: { label: t("tips.cta.openPlan"), to: "/plan" },
        chatPrompt: t("tips.planFund.chat", { label: bigUnfunded.label }),
      });
    }
  }

  // ---- Overdue plans (past-month, unresolved) ----
  const nowYm = monthKey(now);
  const overduePlans = planList.filter(
    (p) => !p.done && String(p.month).slice(0, 7) < nowYm,
  );
  if (overduePlans.length) {
    const first = overduePlans[0];
    tips.push({
      id: "plans-overdue",
      severity: "warning",
      title: t("tips.overduePlans.title", { count: overduePlans.length }),
      detail: t("tips.overduePlans.detail", {
        label: first.label,
        month: monthLabel(String(first.month).slice(0, 7)),
      }),
      cta: { label: t("tips.cta.openPlan"), to: "/plan" },
      chatPrompt: t("tips.overduePlans.chat", { count: overduePlans.length }),
    });
  }

  // ---- Assets: none tracked, but the household has real reserves ----
  const assets = data.assets;
  const assetsTotal = assets.reduce((s, a) => s + Number(a.current_value || 0), 0);
  if (!assets.length && (reserveMonths >= 3 || liquidReserve >= baseline * 3)) {
    tips.push({
      id: "no-assets",
      severity: "info",
      title: t("tips.noAssets.title"),
      detail: t("tips.noAssets.detail"),
      cta: { label: t("tips.cta.addAsset"), to: "/assets" },
      chatPrompt: t("tips.noAssets.chat"),
    });
  }

  // ---- Stale asset values (>12 months since last update) ----
  const staleCutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const staleAssets = assets.filter((a) => new Date(a.updated_at) < staleCutoff);
  if (staleAssets.length) {
    tips.push({
      id: "stale-assets",
      severity: "info",
      title: t("tips.staleAssets.title", { count: staleAssets.length }),
      detail: t("tips.staleAssets.detail", { name: staleAssets[0].name }),
      cta: { label: t("tips.cta.reviewAssets"), to: "/assets" },
      chatPrompt: t("tips.staleAssets.chat"),
    });
  }

  // ---- Illiquid-heavy net worth with a thin liquid reserve ----
  if (assets.length && assetsTotal > 0 && baseline > 0) {
    const illiquidTotal = assets.reduce(
      (s, a) =>
        liquidityForKind(a.kind) === "illiquid" ? s + Number(a.current_value || 0) : s,
      0,
    );
    const illiquidShare = illiquidTotal / assetsTotal;
    if (illiquidShare >= 0.8 && reserveMonths < 3) {
      tips.push({
        id: "illiquid-heavy",
        severity: "warning",
        title: t("tips.illiquidHeavy.title"),
        detail: t("tips.illiquidHeavy.detail", {
          pct: Math.round(illiquidShare * 100),
          months: reserveMonths.toFixed(1),
          target: money(baseline * 3),
        }),
        cta: { label: t("tips.cta.manageBuckets"), to: "/settings" },
        chatPrompt: t("tips.illiquidHeavy.chat"),
      });
    }
  }

  // ---- Intent scale: treat share and tagging habits ----
  const recent = data.recentExpenses;
  if (recent.length >= 10) {
    const intent = summariseIntent(recent);
    const tagged = recent.filter((e) => !!e.intent).length;
    if (
      intent.total > 0 &&
      intent.discretionarySharePct >= 40 &&
      income > 0 &&
      surplus / income < 0.1
    ) {
      tips.push({
        id: "high-treat-share",
        severity: "warning",
        title: t("tips.highTreatShare.title", { pct: Math.round(intent.discretionarySharePct) }),
        detail: t("tips.highTreatShare.detail", {
          discretionary: money(intent.discretionary),
          treat: money(intent.treat),
        }),
        chatPrompt: t("tips.highTreatShare.chat", {
          pct: Math.round(intent.discretionarySharePct),
        }),
      });
    }

    // Standalone: nice-to-haves + treats are a large share of spending even when
    // saving is healthy. Framed as an opportunity to reach goals sooner, not a
    // problem (when the surplus is thin, high-treat-share above already covers
    // it). Household-only — the intent scale is a household concept.
    const lowSavings = income > 0 && surplus / income < 0.1;
    if (!isBusiness && intent.total > 0 && intent.discretionarySharePct >= 45 && !lowSavings) {
      const heavy = intent.discretionarySharePct >= 55;
      tips.push({
        id: "discretionary-heavy",
        severity: heavy ? "warning" : "info",
        title: t("tips.discretionaryHeavy.title", {
          pct: Math.round(intent.discretionarySharePct),
        }),
        detail: t("tips.discretionaryHeavy.detail", {
          discretionary: money(intent.discretionary),
          treat: money(intent.treat),
        }),
        chatPrompt: t("tips.discretionaryHeavy.chat", {
          pct: Math.round(intent.discretionarySharePct),
        }),
      });
    }
    if (tagged === 0 && recent.length >= 15) {
      tips.push({
        id: "untagged-intent",
        severity: "info",
        title: t("tips.untaggedIntent.title"),
        detail: t("tips.untaggedIntent.detail"),
        cta: { label: t("tips.cta.openExpenses"), to: "/expenses" },
        chatPrompt: t("tips.untaggedIntent.chat"),
      });
    }
    // Consistent "treat" behaviour on essentials-labelled categories tends to be
    // upgrades disguised as needs — surface it gently when the reserve is thin.
    if (reserveMonths < 3 && intent.byLevel.treat > intent.byLevel.essential * 0.5) {
      tips.push({
        id: "treats-vs-reserve",
        severity: "info",
        title: t("tips.treatsVsReserve.title"),
        detail: t("tips.treatsVsReserve.detail", {
          treat: money(intent.byLevel.treat),
          months: reserveMonths.toFixed(1),
        }),
        chatPrompt: t("tips.treatsVsReserve.chat"),
      });
    }
  }


  const rank: Record<Severity, number> = { critical: 0, warning: 1, info: 2, success: 3 };
  tips.sort((a, b) => rank[a.severity] - rank[b.severity]);

  const active = tips.filter((t) => !dismissed.has(t.id));
  const hidden = tips.filter((t) => dismissed.has(t.id));

  function openChat(prompt: string) {
    window.dispatchEvent(new CustomEvent("coach:open", { detail: { prompt } }));
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
