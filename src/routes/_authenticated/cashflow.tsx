import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { supabase } from "@/integrations/supabase/client";
import { pageShellClass } from "@/components/page-shell";
import { IncomesSection, FixedExpensesSection, VariableEstimatesSection } from "@/routes/_authenticated/settings";
import { SpendingVsEstimate } from "@/components/spending-vs-estimate";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { cycleForSpace, perCycleFromMonthly } from "@/lib/cadence";
import { computeCycle } from "@/lib/cycle";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/cashflow")({
  head: () => ({ meta: [{ title: "Payables & Receivables · bynku" }] }),
  component: CashflowPage,
});

function CashflowPage() {
  const t = useT();
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () => fetchHh({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
  });
  const householdId = hh?.household?.id;
  const isBusiness = hh?.household?.kind === "business";
  const cycle = cycleForSpace(hh?.household);
  const cycleSuffix = t(`cadence.short.${cycle}`);

  const [view, setView] = useState<"all" | "in" | "out">("all");

  // Estimated (monthly-equivalent) recurring inflows and outflows, plus
  // actual money in/out logged so far in the current cycle. Everything is
  // normalized to the household's chosen cycle before display.
  const { data: summary } = useQuery({
    enabled: !!householdId,
    queryKey: ["cashflow-summary", householdId],
    queryFn: async () => {
      const [inc, fx, ve, salaries] = await Promise.all([
        supabase.from("incomes").select("monthly_amount").eq("household_id", householdId!),
        supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", householdId!),
        supabase.from("variable_estimates").select("monthly_amount").eq("household_id", householdId!),
        supabase
          .from("expenses")
          .select("occurred_at")
          .eq("household_id", householdId!)
          .eq("kind", "income")
          .eq("is_salary", true)
          .order("occurred_at", { ascending: false })
          .limit(12),
      ]);
      const totalIn = (inc.data ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      const totalFixed = (fx.data ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      const totalVar = (ve.data ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      const cycleBounds = computeCycle((salaries.data ?? []).map((r) => r.occurred_at as string));
      const { data: exps } = await supabase
        .from("expenses")
        .select("amount, kind")
        .eq("household_id", householdId!)
        .gte("occurred_at", cycleBounds.start.toISOString())
        .lt("occurred_at", cycleBounds.end.toISOString());
      let actualIn = 0;
      let actualOut = 0;
      for (const e of exps ?? []) {
        const a = Number(e.amount) || 0;
        if (e.kind === "income") actualIn += a;
        else actualOut += a;
      }
      return {
        totalIn,
        totalFixed,
        totalVar,
        totalOut: totalFixed + totalVar,
        net: totalIn - totalFixed - totalVar,
        actualIn,
        actualOut,
        actualNet: actualIn - actualOut,
      };
    },
  });

  const totalIn = summary?.totalIn ?? 0;
  const totalFixed = summary?.totalFixed ?? 0;
  const totalVar = summary?.totalVar ?? 0;
  const totalOut = summary?.totalOut ?? 0;
  const net = summary?.net ?? 0;
  const actualIn = summary?.actualIn ?? 0;
  const actualOut = summary?.actualOut ?? 0;
  const actualNet = summary?.actualNet ?? 0;
  // Estimate-vs-actual gap for outflows in the current cycle. Positive means
  // spending exceeds the plan; negative means under budget.
  const expectedOutCycle = perCycleFromMonthly(totalOut, cycle);
  const gap = actualOut - expectedOutCycle;

  return (
    <div className={pageShellClass("3xl")}>
      <header>
        <h1 className="text-3xl md:text-4xl font-display">
          {t(isBusiness ? "cashflow.titleBiz" : "cashflow.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(isBusiness ? "cashflow.subtitleBiz" : "cashflow.subtitle")}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("cashflow.estimatedSection")}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryStat
            label={t(isBusiness ? "cashflow.inBiz" : "cashflow.in")}
            value={money(perCycleFromMonthly(totalIn, cycle))}
            suffix={cycleSuffix}
            info={t("cashflow.info.in")}
          />
          <SummaryStat
            label={t("cashflow.fixed")}
            value={money(perCycleFromMonthly(totalFixed, cycle))}
            suffix={cycleSuffix}
            info={t("cashflow.info.fixed")}
          />
          <SummaryStat
            label={t("cashflow.variable")}
            value={money(perCycleFromMonthly(totalVar, cycle))}
            suffix={cycleSuffix}
            info={t("cashflow.info.variable")}
          />
          <SummaryStat
            label={t("cashflow.net")}
            value={money(perCycleFromMonthly(net, cycle))}
            suffix={cycleSuffix}
            highlight
            tone={net >= 0 ? "good" : "bad"}
            info={t("cashflow.info.net")}
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("cashflow.actualSection")}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryStat
            label={t("cashflow.realIn")}
            value={money(actualIn)}
            suffix=""
            info={t("cashflow.info.realIn")}
          />
          <SummaryStat
            label={t("cashflow.realOut")}
            value={money(actualOut)}
            suffix=""
            info={t("cashflow.info.realOut")}
          />
          <SummaryStat
            label={t("cashflow.gap")}
            value={`${gap >= 0 ? "+" : "−"}${money(Math.abs(gap))}`}
            suffix=""
            tone={gap > 0 ? "bad" : "good"}
            info={t("cashflow.info.gap")}
          />
          <SummaryStat
            label={t("cashflow.netReal")}
            value={money(actualNet)}
            suffix=""
            highlight
            tone={actualNet >= 0 ? "good" : "bad"}
            info={t("cashflow.info.netReal")}
          />
        </div>
      </section>

      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <TabsList>
          <TabsTrigger value="all">{t("cashflow.all")}</TabsTrigger>
          <TabsTrigger value="in">{t(isBusiness ? "cashflow.inBiz" : "cashflow.in")}</TabsTrigger>
          <TabsTrigger value="out">{t(isBusiness ? "cashflow.outBiz" : "cashflow.out")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {householdId && (view === "all" || view === "in") && (
        <IncomesSection householdId={householdId} cycle={cycle} isBusiness={isBusiness} />
      )}
      {householdId && (view === "all" || view === "out") && (
        <FixedExpensesSection householdId={householdId} cycle={cycle} />
      )}
      {householdId && (view === "all" || view === "out") && (
        <VariableEstimatesSection householdId={householdId} />
      )}
      {householdId && (view === "all" || view === "out") && (
        <SpendingVsEstimate householdId={householdId} />
      )}


      <Card className="border-dashed bg-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4" /> {t("cashflow.plansTitle")}
          </CardTitle>
          <CardDescription>{t("cashflow.plansBody")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <Link to="/plan">{t("cashflow.plansCta")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  suffix,
  highlight,
  tone,
  info,
}: {
  label: string;
  value: string;
  suffix: string;
  highlight?: boolean;
  tone?: "good" | "bad";
  info?: string;
}) {
  const toneCls =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "bad"
        ? "text-destructive"
        : "";
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/5" : ""}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          {info && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`${label} — info`}
                  className="shrink-0 text-muted-foreground/70 hover:text-foreground transition-colors"
                >
                  <Info className="size-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" className="text-xs leading-relaxed w-64">
                {info}
              </PopoverContent>
            </Popover>
          )}
        </div>
        <p className={`text-2xl font-display mt-1 tabular-nums ${toneCls}`}>
          {value}
          <span className="text-sm font-sans text-muted-foreground">{suffix}</span>
        </p>
      </CardContent>
    </Card>
  );
}
