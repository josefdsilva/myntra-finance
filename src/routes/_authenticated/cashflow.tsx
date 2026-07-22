import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock } from "lucide-react";

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

  // Net recurring cashflow per month = recurring income − recurring costs, both
  // read from the canonical monthly-equivalent so cadence is already baked in.
  const { data: summary } = useQuery({
    enabled: !!householdId,
    queryKey: ["cashflow-summary", householdId],
    queryFn: async () => {
      const [inc, fx] = await Promise.all([
        supabase.from("incomes").select("monthly_amount").eq("household_id", householdId!),
        supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", householdId!),
      ]);
      const totalIn = (inc.data ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      const totalOut = (fx.data ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      return { totalIn, totalOut, net: totalIn - totalOut };
    },
  });

  const totalIn = summary?.totalIn ?? 0;
  const totalOut = summary?.totalOut ?? 0;
  const net = summary?.net ?? 0;

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryStat
          label={t(isBusiness ? "cashflow.inBiz" : "cashflow.in")}
          value={money(perCycleFromMonthly(totalIn, cycle))}
          suffix={cycleSuffix}
        />
        <SummaryStat
          label={t(isBusiness ? "cashflow.outBiz" : "cashflow.out")}
          value={money(perCycleFromMonthly(totalOut, cycle))}
          suffix={cycleSuffix}
        />
        <SummaryStat
          label={t("cashflow.net")}
          value={money(perCycleFromMonthly(net, cycle))}
          suffix={cycleSuffix}
          highlight
          tone={net >= 0 ? "good" : "bad"}
        />
      </div>

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
}: {
  label: string;
  value: string;
  suffix: string;
  highlight?: boolean;
  tone?: "good" | "bad";
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
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-2xl font-display mt-1 tabular-nums ${toneCls}`}>
          {value}
          <span className="text-sm font-sans text-muted-foreground">{suffix}</span>
        </p>
      </CardContent>
    </Card>
  );
}
