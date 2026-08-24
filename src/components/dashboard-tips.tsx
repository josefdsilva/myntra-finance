import type * as React from "react";
import { useEffect, useReducer, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { issueFacts } from "@/lib/issue-facts.functions";
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
import { expectedCategorySpend } from "@/lib/benchmarks";
import { findSavings } from "@/lib/savings-finder";
import { priciestClearableDebt, HIGH_APR_PCT } from "@/lib/debt-apr";
import { cycleForSpace, perCycleFromMonthly } from "@/lib/cadence";
import { useT, type MessageKey } from "@/lib/i18n";
import {
  AlertTriangle,
  AlertOctagon,
  Landmark,
  Info,
  CheckCircle2,
  ArrowRight,
  MessageSquare,
  X,
  Undo2,
  ChevronDown,
} from "lucide-react";

type Severity = "critical" | "warning" | "info" | "success";

// Every tip belongs to one theme. Among the NON-critical tips we keep only the
// single strongest tip per theme, so the old clusters (four reserve tips, three
// estimate tips, several savings tips) collapse into one line each instead of
// stacking. Criticals are never deduped or hidden.
type Theme =
  | "sustainability"
  | "debt"
  | "savings"
  | "reserve"
  | "allocation"
  | "estimates"
  | "planning"
  | "concentration"
  | "assets"
  | "tagging"
  | "setup";

type Tip = {
  id: string;
  severity: Severity;
  title: string;
  detail?: string;
  cta?: { label: string; to: string };
  /** Prefilled question to send to the AI coach when the user clicks "Chat". */
  chatPrompt?: string;
  icon?: React.ReactNode;
};

// id → theme. Prefix match handles the per-bucket/per-plan dynamic ids
// (goal-*, plan-*). Anything unlisted falls back to its own id (never deduped
// against another theme).
const THEME_BY_ID: Record<string, Theme> = {
  "negative-surplus": "sustainability",
  "close-gap": "sustainability",
  "low-savings-rate": "sustainability",
  overpace: "sustainability",
  "expensive-debt": "debt",
  "where-to-save": "savings",
  "income-room": "savings",
  "high-treat-share": "savings",
  "discretionary-heavy": "savings",
  "treats-vs-reserve": "savings",
  "no-emergency-bucket": "reserve",
  "over-investing": "reserve",
  "under-investing": "reserve",
  "illiquid-heavy": "reserve",
  "over-allocated": "allocation",
  "unallocated-surplus": "allocation",
  "confirm-allocations": "allocation",
  "verify-estimates": "estimates",
  "estimates-too-low": "estimates",
  "estimates-too-high": "estimates",
  "no-variable-estimates": "estimates",
  "no-fixed": "estimates",
  "single-income-source": "concentration",
  "income-concentration": "concentration",
  "no-assets": "assets",
  "stale-assets": "assets",
  "untagged-intent": "tagging",
  "no-baseline": "setup",
  "no-income": "setup",
  "no-buckets": "setup",
};
function themeOf(id: string): string {
  if (THEME_BY_ID[id]) return THEME_BY_ID[id];
  if (id.startsWith("goal-") || id.startsWith("plan-")) return "planning";
  return id;
}

// Dismissal keys are stabilised so a tip whose id embeds volatile data (the
// shortfall month, or which variant a goal is currently in) can't re-appear
// under a new id once dismissed. Per-bucket goal tips keep their bucket id so
// dismissing goal A doesn't hide goal B.
function dismissKeyOf(id: string): string {
  const g = id.match(/^goal-(?:close|unrealistic|too-easy)-(.+)$/);
  if (g) return `goal:${g[1]}`;
  if (id.startsWith("plan-shortfall-")) return "plan-shortfall";
  return id;
}

const EMERGENCY_HINTS = ["emergency", "buffer", "safety", "rainy", "reserve"];

const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" });

export type IssuesResult = {
  loading: boolean;
  criticals: Tip[];
  primary: Tip[];
  overflow: Tip[];
  hidden: Tip[];
  urgentCount: number;
  totalActive: number;
  totalTips: number;
  dismiss: (id: string) => void;
  restore: (id: string) => void;
};

/**
 * Single source of the household's live "issues & tips": fetches canonical cycle
 * facts + the supporting rows, builds the prioritised, de-duplicated list, and
 * owns dismissal. Consumed by BOTH the dashboard card and the app-wide issues
 * bell, so the two always agree. Dismissal is read straight from localStorage
 * each render (no flash), keyed by the payday cycle rather than the calendar
 * month (so it doesn't silently reset), and broadcast across instances.
 */
export function useHouseholdIssues(householdId: string): IssuesResult {
  const t = useT();
  const qc = useQueryClient();
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const factsFn = useServerFn(issueFacts);
  const { data: facts } = useQuery({
    queryKey: ["issue-facts", householdId],
    queryFn: async () => {
      try {
        return await factsFn({ data: { household_id: householdId } });
      } catch {
        return null;
      }
    },
    enabled: !!householdId,
    retry: false,
  });
  // Household-only now: `bt` is a thin wrapper kept so the many call sites don't
  // churn — it always resolves the plain (household) copy.
  const bt = (key: string, vars?: Record<string, string | number>) =>
    t(key as MessageKey, vars);

  // Dismissal: cycle-aligned storage key, read from localStorage on every render
  // (so there's no flash of already-dismissed tips before an effect loads them),
  // and synced across component instances via a window event.
  const cycleKey = facts?.cycleKey ?? null;
  const storageKey = cycleKey ? `issues-dismissed:${householdId}:${cycleKey}` : null;
  const [, bumpDismissed] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const on = () => bumpDismissed();
    window.addEventListener("issues:changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("issues:changed", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  const readSet = (key: string): Set<string> => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  };
  const dismissedSet = storageKey ? readSet(storageKey) : new Set<string>();
  const writeSet = (s: Set<string>) => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(s)));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("issues:changed"));
  };
  function dismiss(id: string) {
    if (!storageKey) return;
    const s = readSet(storageKey);
    s.add(dismissKeyOf(id));
    writeSet(s);
  }
  function restore(id: string) {
    if (!storageKey) return;
    const s = readSet(storageKey);
    s.delete(dismissKeyOf(id));
    writeSet(s);
  }

  const { data } = useQuery({
    queryKey: ["dashboard-tips", householdId, period],
    enabled: !!householdId,
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
        { count: estFixed },
        { count: estVar },
        { data: debtsDetail },
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
        supabase
          .from("fixed_expenses")
          .select("id", { count: "exact", head: true })
          .eq("household_id", householdId)
          .eq("is_estimated", true),
        supabase
          .from("variable_estimates")
          .select("id", { count: "exact", head: true })
          .eq("household_id", householdId)
          .eq("is_estimated", true),
        supabase
          .from("debts")
          .select(
            "id, label, taeg_pct, tan_pct, deduced_rate_pct, principal_remaining, starting_principal",
          )
          .eq("household_id", householdId),
      ]);
      // When was anything last added? Drives the gentle "time to update" nudge.
      const { data: lastEntry } = await supabase
        .from("expenses")
        .select("created_at")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const allTimeTotals: Record<string, number> = {};
      for (const r of allTimeAllocations ?? []) {
        allTimeTotals[r.bucket_id] = (allTimeTotals[r.bucket_id] ?? 0) + Number(r.amount);
      }
      return {
        lastEntryAt: (lastEntry?.created_at as string | null) ?? null,
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
        estimatedCount: (estFixed ?? 0) + (estVar ?? 0),
        debtsDetail: (debtsDetail ?? []) as Array<{
          id: string;
          label: string | null;
          taeg_pct: number | string | null;
          tan_pct: number | string | null;
          deduced_rate_pct: number | string | null;
          principal_remaining: number | string | null;
          starting_principal: number | string | null;
        }>,
      };
    },
  });

  const emptyResult: IssuesResult = {
    loading: true,
    criticals: [],
    primary: [],
    overflow: [],
    hidden: [],
    urgentCount: 0,
    totalActive: 0,
    totalTips: 0,
    dismiss,
    restore,
  };
  if (!data || !facts) return emptyResult;

  const { baseline, income, surplus, variablePool, netSpent, daysLeft, avgDaily7 } = facts;
  const country = facts.country;
  const adults = facts.adults;
  const children = facts.children;
  const ageBand = facts.ageBand;
  const marginPct = facts.marginPct;
  const cycle = facts.cycle;

  const tips: Tip[] = [];

  // ---- Freshness: a gentle "time to update" nudge ----
  // Bynku is a check-in tool, not a daily chore — updating weekly/per-cycle is
  // the intent. But once a couple of weeks pass with nothing new, the numbers
  // drift, so surface ONE dismissible nudge to import a statement. Never a nag.
  if (data.expenseCount > 0 && data.lastEntryAt) {
    const days = Math.floor((now.getTime() - new Date(data.lastEntryAt).getTime()) / 86_400_000);
    if (days >= 14) {
      tips.push({
        id: "stale-data",
        severity: "info",
        title: t("tips.staleData.title"),
        detail: t("tips.staleData.detail", { days }),
        cta: { label: t("tips.cta.importStatement"), to: "/share" },
      });
    }
  }

  // ---- Estimates still to confirm (surface first for a fresh preset) ----
  if (data.estimatedCount > 0) {
    tips.push({
      id: "verify-estimates",
      severity: "warning",
      title: t("tips.verifyEstimates.title"),
      detail: t("tips.verifyEstimates.detail"),
      cta: { label: t("tips.cta.reviewEstimates"), to: "/cashflow" },
      chatPrompt: t("tips.verifyEstimates.chat"),
    });
  }

  // ---- Where's the room — only when it's genuinely tight (never for a
  // comfortable surplus). Answers "what do I change?", not "what's left?". ----
  const nonEssentialMonthly =
    (data.recentExpenses.reduce((s, r) => {
      const level = resolveIntent({ intent: r.intent, category: r.category });
      return level === "nice_to_have" || level === "treat" ? s + Number(r.amount || 0) : s;
    }, 0) *
      30) /
    45;
  const est =
    income > 0 && country
      ? expectedCategorySpend({ country, adults, children, monthlyIncome: income })
      : null;
  const savings = findSavings({
    income,
    surplus,
    marginPct,
    ageBand,
    incomeQuintile: est?.quintile ?? null,
    nonEssentialMonthly,
    // When the baseline already exceeds income, the household is underwater — pass
    // the overspend so "where to cut" surfaces (and reads as break-even, not "€X
    // short of a cushion"). This is exactly the case a family like Rui's needs.
    deficit: Math.max(0, baseline - income),
  });
  // Figures are monthly (benchmark-based); express them in the household's cycle.
  const cyclePeriod = cycleForSpace({ cycle: cycle ?? null });
  const per = t(`period.per.${cyclePeriod}` as MessageKey);
  const cyc = (m: number) => money(perCycleFromMonthly(m, cyclePeriod));
  if (savings.surface && savings.spending.length > 0) {
    const breakeven = savings.mode === "breakeven";
    tips.push({
      id: "where-to-save",
      severity: "warning",
      title: breakeven ? t("tips.whereToSave.titleDeficit") : t("tips.whereToSave.title"),
      detail: breakeven
        ? t("tips.whereToSave.detailDeficit", {
            deficit: cyc(savings.deficitEur),
            amount: cyc(savings.spending[0].monthlyEur),
            per,
          })
        : t("tips.whereToSave.detail", {
            gap: cyc(savings.gapEur),
            amount: cyc(savings.spending[0].monthlyEur),
            per,
          }),
      cta: { label: t("tips.cta.whereToCut"), to: "/analysis" },
      chatPrompt: breakeven
        ? t("tips.whereToSave.chatDeficit", { deficit: cyc(savings.deficitEur), per })
        : t("tips.whereToSave.chat", { gap: cyc(savings.gapEur), per }),
    });
  }
  if (savings.surface && savings.income.length > 0) {
    // Dignified, under-55 only: a better-paid role for the same hours. Deeper
    // moves (part-time, relocation, sell-and-rent) are left to the coach chat.
    tips.push({
      id: "income-room",
      severity: "info",
      title: t("tips.incomeRoom.title"),
      detail: t("tips.incomeRoom.detail"),
      chatPrompt: t("tips.incomeRoom.chat"),
    });
  }

  // ---- Too little room to save — the plain version, only when the richer
  // "where's the room" tip above didn't fire. ----
  if (!savings.surface && income > 0 && surplus > 0 && surplus < income * 0.05) {
    tips.push({
      id: "close-gap",
      severity: "warning",
      title: t("tips.closeGap.title"),
      detail: t("tips.closeGap.detail", { surplus: money(surplus), income: money(income) }),
      cta: { label: t("tips.cta.reviewBaseline"), to: "/settings" },
      chatPrompt: t("tips.closeGap.chat"),
    });
  }

  // ---- Expensive debt: the one loan bleeding the most per euro ----
  // Rui's case — a 17.5% card next to an 8.9% car loan — should be surfaced, not
  // hidden in Loans. We name the specific loan and tell him to attack it first;
  // when it's also the smallest balance, avalanche and snowball agree, so the
  // advice is unambiguous. A painful rate (>= HIGH_APR_PCT, credit-card
  // territory) is a critical shout; a merely expensive one (>= PRIORITY_APR_PCT,
  // e.g. a 9–12% personal loan) is a warning — still worth clearing next.
  {
    const pricey = priciestClearableDebt(data.debtsDetail);
    if (pricey) {
      const label = pricey.debt.label ?? t("tips.expensiveDebt.fallbackLabel");
      tips.push({
        id: "expensive-debt",
        severity: pricey.apr >= HIGH_APR_PCT ? "critical" : "warning",
        icon: <Landmark className="size-4" />,
        title: t("tips.expensiveDebt.title", { label }),
        detail: pricey.isSmallestBalance
          ? t("tips.expensiveDebt.detailSmallest", {
              label,
              apr: pricey.apr.toFixed(1),
              balance: money(pricey.balance),
            })
          : t("tips.expensiveDebt.detail", {
              label,
              apr: pricey.apr.toFixed(1),
              balance: money(pricey.balance),
            }),
        cta: { label: t("tips.cta.payoffPlan"), to: "/loans" },
        chatPrompt: t("tips.expensiveDebt.chat", { label, apr: pricey.apr.toFixed(1) }),
      });
    }
  }

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

  // ---- Confirmations near the end of the payday cycle ----
  const unconfirmed = data.buckets.filter(
    (b) => !data.confirmations.some((c) => c.bucket_id === b.id),
  );
  if (data.buckets.length && daysLeft <= 7 && unconfirmed.length) {
    tips.push({
      id: "confirm-allocations",
      severity: "warning",
      title: t("tips.confirmAllocations.title", { count: unconfirmed.length }),
      detail: t("tips.confirmAllocations.detail", {
        days: daysLeft,
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
    if (intent.total > 0 && intent.discretionarySharePct >= 45 && !lowSavings) {
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


  // ---- Prioritise + de-duplicate ----
  // Order of operations: keep every critical (never hidden), then dedupe the
  // remaining tips to the single strongest one per theme (so the reserve /
  // estimates / savings / planning clusters collapse to one line each), then cap
  // the non-criticals — the top few show, the rest wait behind "show more".
  const rank: Record<Severity, number> = { critical: 0, warning: 1, info: 2, success: 3 };
  const bySeverity = (a: Tip, b: Tip) => rank[a.severity] - rank[b.severity];

  const isHidden = (tp: Tip) => dismissedSet.has(dismissKeyOf(tp.id));
  const visible = tips.filter((tp) => !isHidden(tp));
  const hidden = tips.filter(isHidden);

  const criticals = visible.filter((tp) => tp.severity === "critical").sort(bySeverity);
  const seenTheme = new Set<string>();
  const deduped: Tip[] = [];
  for (const tp of visible.filter((tp) => tp.severity !== "critical").sort(bySeverity)) {
    const th = themeOf(tp.id);
    if (seenTheme.has(th)) continue;
    seenTheme.add(th);
    deduped.push(tp);
  }

  const NON_CRITICAL_CAP = 3;
  const primary = deduped.slice(0, NON_CRITICAL_CAP);
  const overflow = deduped.slice(NON_CRITICAL_CAP);

  return {
    loading: false,
    criticals,
    primary,
    overflow,
    hidden,
    urgentCount: criticals.length,
    totalActive: criticals.length + deduped.length,
    totalTips: tips.length,
    dismiss,
    restore,
  };
}

// Both surfaces route a tip's "Chat" button to the app-wide coach dock.
function openIssuesChat(prompt: string) {
  window.dispatchEvent(new CustomEvent("coach:open", { detail: { prompt } }));
}

/**
 * The dashboard "issues & tips" card — the full, inline view. Uses the shared
 * hook, so it shows exactly what the app-wide bell shows.
 */
export function DashboardTips({ householdId }: { householdId: string }) {
  const t = useT();
  const [showMore, setShowMore] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const issues = useHouseholdIssues(householdId);
  if (issues.loading) return null;
  const { criticals, primary, overflow, hidden, urgentCount, totalTips, dismiss, restore } = issues;
  const shown = [...criticals, ...primary];

  if (!shown.length && !overflow.length) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="pt-6 flex items-start gap-3">
          <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">
              {totalTips === 0 ? t("tips.allGood") : t("tips.allAcknowledged")}
            </p>
            <p className="text-sm text-muted-foreground">
              {totalTips === 0
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
                onChat={openIssuesChat}
              />
            ))}
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <Card className={urgentCount > 0 ? "border-destructive/30" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertOctagon
            className={`size-5 ${urgentCount > 0 ? "text-destructive" : "text-amber-500"}`}
          />
          {t("tips.attention.title")}
          {urgentCount > 0 && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              {t("tips.attention.urgent", { count: urgentCount })}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {t("tips.description", { chat: t("tips.chatButton"), dismiss: t("tips.dismissButton") })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {shown.map((tip) => (
          <TipRow key={tip.id} tip={tip} onDismiss={() => dismiss(tip.id)} onChat={openIssuesChat} />
        ))}
        {overflow.length > 0 &&
          (showMore ? (
            overflow.map((tip) => (
              <TipRow
                key={tip.id}
                tip={tip}
                onDismiss={() => dismiss(tip.id)}
                onChat={openIssuesChat}
              />
            ))
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-center text-xs text-muted-foreground"
              onClick={() => setShowMore(true)}
            >
              <ChevronDown className="size-3" /> {t("tips.showMoreLower", { count: overflow.length })}
            </Button>
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
              onChat={openIssuesChat}
            />
          ))}
      </CardContent>
    </Card>
  );
}

/**
 * App-wide entry point to the same issues the dashboard card shows, sharing the
 * hook's dismissal so hiding here also hides on the card. Two triggers:
 *  - `variant="bell"` — a bell + badge (mobile top bar).
 *  - `variant="nav"`  — a full-width "Needs attention · N" row for the sidebar
 *    nav; renders nothing when there's nothing to flag, so it only appears when
 *    it has something to say.
 */
export function IssuesBell({
  householdId,
  align = "right",
  variant = "bell",
}: {
  householdId: string | null;
  /** Which edge the panel anchors to. "right" opens leftward (wide headers);
      "left" opens rightward (use inside the narrow left sidebar so it doesn't
      run off-screen). */
  align?: "left" | "right";
  variant?: "bell" | "nav";
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const issues = useHouseholdIssues(householdId ?? "");

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!householdId) return null;
  const { criticals, primary, overflow, urgentCount, dismiss } = issues;
  const active = [...criticals, ...primary, ...overflow];
  const count = active.length;
  // The nav row is a contextual entry: show it only when there's something to
  // flag, so it never sits there saying "0".
  if (variant === "nav" && count === 0) return null;

  return (
    <div ref={wrapRef} className="relative">
      {variant === "nav" ? (
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
            urgentCount > 0
              ? "border border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10"
              : "border border-amber-500/40 bg-amber-500/5 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400",
          )}
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1 truncate">{t("tips.attention.title")}</span>
          <span
            className={cn(
              "flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-5 text-white",
              urgentCount > 0 ? "bg-destructive" : "bg-amber-500",
            )}
          >
            {count > 9 ? "9+" : count}
          </span>
        </button>
      ) : (
        <button
          type="button"
          aria-label={t("tips.bell.aria")}
          onClick={() => setOpen((s) => !s)}
          className="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <AlertTriangle className="size-5" />
          {count > 0 && (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-4 text-white",
                urgentCount > 0 ? "bg-destructive" : "bg-amber-500",
              )}
            >
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      )}

      {open && (
        <div
          className={cn(
            "fixed inset-x-3 top-[4.5rem] z-50 w-auto overflow-hidden rounded-xl border bg-card shadow-2xl",
            "md:absolute md:inset-x-auto md:top-full md:mt-2 md:w-[min(92vw,24rem)]",
            align === "right" ? "md:right-0" : "md:left-0",
          )}
        >
          <div className="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-medium">
            <AlertOctagon
              className={`size-4 ${urgentCount > 0 ? "text-destructive" : "text-amber-500"}`}
            />
            {t("tips.attention.title")}
            {urgentCount > 0 && (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                {t("tips.attention.urgent", { count: urgentCount })}
              </span>
            )}
          </div>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto p-3">
            {count === 0 ? (
              <div className="px-2 py-10 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="mx-auto mb-2 size-6 text-emerald-600 opacity-70" />
                {t("tips.bell.empty")}
              </div>
            ) : (
              <>
                {active.map((tip) => (
                  <TipRow
                    key={tip.id}
                    tip={tip}
                    onDismiss={() => dismiss(tip.id)}
                    onChat={openIssuesChat}
                  />
                ))}
                <a
                  href="/"
                  onClick={() => setOpen(false)}
                  className="block pt-1 text-center text-xs font-medium text-primary hover:underline"
                >
                  {t("tips.bell.openFull")}
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </div>
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
      border: "border-destructive/60",
      bg: "bg-destructive/10",
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
  const prominent = tip.severity === "critical";
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border ${s.border} ${s.bg} ${prominent ? "p-3.5" : "p-3"} ${dismissed ? "opacity-60" : ""}`}
    >
      <div className={`mt-0.5 shrink-0 ${s.iconWrap}`}>{tip.icon ?? s.icon}</div>
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${prominent ? "text-[15px] text-destructive" : "text-sm"}`}>
          {tip.title}
        </p>
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
