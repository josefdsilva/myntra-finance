import { pageMeta } from "@/lib/route-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { supabase } from "@/integrations/supabase/client";
import { pageShellClass } from "@/components/page-shell";
import {
  IncomesSection,
  FixedExpensesSection,
  VariableEstimatesSection,
} from "@/routes/_authenticated/settings";
import { SpendingVsEstimate } from "@/components/spending-vs-estimate";
import { CommittedThisCycle, PlannedThisCycle } from "@/components/cycle-ledger";
import { PlanPanel } from "@/routes/_authenticated/plan";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { money } from "@/lib/format";
import { cycleForSpace, perCycleFromMonthly } from "@/lib/cadence";
import { fetchCycleBounds, cycleKeyPart } from "@/lib/cycle-bounds";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/cashflow")({
  head: () =>
    pageMeta({
      path: "/cashflow",
      title: "Payables & receivables · bynku",
      description:
        "See recurring income, fixed bills, variable estimates and what actually moved this cycle in one place.",
      noindex: true,
    }),
  // ?lens=cycle|planned deep-links a specific lens (used by redirects + CTAs).
  validateSearch: (search: Record<string, unknown>): { lens?: "cycle" | "planned" } => ({
    lens:
      search.lens === "cycle" || search.lens === "planned"
        ? (search.lens as "cycle" | "planned")
        : undefined,
  }),
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
  const baseline = Number(hh?.household?.baseline_budget ?? 0);

  const { lens: lensParam } = Route.useSearch();
  const [lens, setLens] = useState<"recurring" | "cycle" | "planned">(lensParam ?? "cycle");

  // Estimated (monthly-equivalent) recurring inflows and outflows, plus
  // actual money in/out logged so far in the current cycle. Everything is
  // normalized to the household's chosen cycle before display.
  const { data: summary } = useQuery({
    enabled: !!householdId,
    queryKey: ["cashflow-summary", householdId, ...cycleKeyPart(hh?.household)],
    queryFn: async () => {
      const [inc, fx, ve, db, cycleBounds] = await Promise.all([
        supabase.from("incomes").select("monthly_amount").eq("household_id", householdId!),
        supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", householdId!),
        supabase
          .from("variable_estimates")
          .select("monthly_amount")
          .eq("household_id", householdId!),
        supabase.from("debts").select("monthly_amount").eq("household_id", householdId!),
        fetchCycleBounds(supabase, householdId!, hh?.household),
      ]);
      const totalIn = (inc.data ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      const totalFixed = (fx.data ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      const totalVar = (ve.data ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      // Debt servicing is real recurring money out — the baseline already counts
      // it, so the cashflow roll-up must too, or "net" reads too rosy.
      const totalDebt = (db.data ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
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
        totalDebt,
        totalOut: totalFixed + totalVar + totalDebt,
        net: totalIn - totalFixed - totalVar - totalDebt,
        actualIn,
        actualOut,
        actualNet: actualIn - actualOut,
      };
    },
  });

  const totalIn = summary?.totalIn ?? 0;
  const totalFixed = summary?.totalFixed ?? 0;
  const totalVar = summary?.totalVar ?? 0;
  const totalDebt = summary?.totalDebt ?? 0;
  const totalOut = summary?.totalOut ?? 0;
  const net = summary?.net ?? 0;
  const actualIn = summary?.actualIn ?? 0;
  const loggedOut = summary?.actualOut ?? 0;
  // True money out this cycle = assumed fixed costs + assumed debt servicing +
  // everything logged as spending. Fixed costs and debt are auto-paid (not
  // recorded as individual expenses), so they don't overlap with loggedOut and
  // adding them can't double-count — it just stops the actuals understating.
  const fixedThisCycle = perCycleFromMonthly(totalFixed, cycle);
  const debtThisCycle = perCycleFromMonthly(totalDebt, cycle);
  const actualOut = loggedOut + fixedThisCycle + debtThisCycle;
  const actualNet = actualIn - actualOut;
  // Estimate-vs-actual gap for outflows in the current cycle. Positive means
  // spending exceeds the plan; negative means under budget.
  const expectedOutCycle = perCycleFromMonthly(totalOut, cycle);
  const gap = actualOut - expectedOutCycle;

  // Compact per-cycle roll-up: Money in, Money out (combined), Net. The out
  // card lists fixed / variable / debt underneath so users still see the
  // breakdown without a wall of cards.
  const fixedCycle = perCycleFromMonthly(totalFixed, cycle);
  const varCycle = perCycleFromMonthly(totalVar, cycle);
  const debtCycle = perCycleFromMonthly(totalDebt, cycle);

  const estimatedSection = (
    <section className="space-y-2">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("cashflow.estimatedSection")}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryStat
          label={t(isBusiness ? "cashflow.inBiz" : "cashflow.in")}
          value={money(perCycleFromMonthly(totalIn, cycle))}
          suffix=""
          info={t("cashflow.info.in")}
        />
        <SummaryStat
          label={t("cashflow.expectedOut")}
          value={money(perCycleFromMonthly(totalOut, cycle))}
          suffix=""
          breakdown={[
            { label: t("cashflow.fixed"), value: money(fixedCycle) },
            { label: t("cashflow.variable"), value: money(varCycle) },
            { label: t("cashflow.debt"), value: money(debtCycle) },
          ]}
        />
        <SummaryStat
          label={t("cashflow.net")}
          value={money(perCycleFromMonthly(net, cycle))}
          suffix=""
          highlight
          tone={net >= 0 ? "good" : "bad"}
          info={t("cashflow.info.net")}
        />
      </div>
    </section>
  );

  return (
    <div className={pageShellClass("5xl")}>
      <header>
        <h1 className="text-3xl md:text-4xl font-display">
          {t(isBusiness ? "cashflow.titleBiz" : "cashflow.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(isBusiness ? "cashflow.subtitleBiz" : "cashflow.subtitle")}
        </p>
      </header>

      <Tabs value={lens} onValueChange={(v) => setLens(v as typeof lens)}>
        <TabsList>
          <TabsTrigger value="recurring">{t("cashflow.lensRecurring")}</TabsTrigger>
          <TabsTrigger value="cycle">{t("cashflow.lensCycle")}</TabsTrigger>
          <TabsTrigger value="planned">{t("cashflow.lensPlanned")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Recurring lens: the steady-state definitions that repeat every cycle. */}
      {lens === "recurring" && (
        <>
          {estimatedSection}

          {householdId && (
            <IncomesSection householdId={householdId} cycle={cycle} isBusiness={isBusiness} />
          )}
          {householdId && <FixedExpensesSection householdId={householdId} cycle={cycle} />}
          {householdId && <VariableEstimatesSection householdId={householdId} />}
        </>
      )}

      {/* This-cycle lens: expected (incl. debt) vs what actually happened. */}
      {lens === "cycle" && (
        <>
          {estimatedSection}

          <section className="space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("cashflow.actualSection")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                breakdown={[
                  {
                    label: t("cashflow.gap"),
                    value: `${gap >= 0 ? "+" : "−"}${money(Math.abs(gap))}`,
                    tone: gap > 0 ? "bad" : "good",
                  },
                ]}
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

          {householdId && (
            <CommittedThisCycle householdId={householdId} cycle={cycle} isBusiness={isBusiness} />
          )}
          {householdId && <SpendingVsEstimate householdId={householdId} />}
          {householdId && <PlannedThisCycle householdId={householdId} />}
        </>
      )}

      {/* Planned lens: dated one-offs and the forward forecast, fully in-hub. */}
      {lens === "planned" && householdId && (
        <PlanPanel householdId={householdId} baseline={baseline} isBusiness={isBusiness} />
      )}
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
  breakdown,
}: {
  label: string;
  value: string;
  suffix: string;
  highlight?: boolean;
  tone?: "good" | "bad";
  info?: string;
  breakdown?: { label: string; value: string; tone?: "good" | "bad" }[];
}) {
  const toneCls =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "bad"
        ? "text-destructive"
        : "";
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/5" : ""}>
      <CardContent className="p-4">
        <div className="flex min-h-[2rem] items-start justify-between gap-1">
          <p className="text-xs uppercase tracking-wider leading-tight text-muted-foreground">
            {label}
          </p>
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
        <p
          className={`mt-1 font-display tabular-nums leading-tight whitespace-nowrap text-lg lg:text-xl ${toneCls}`}
        >
          {value}
          <span className="text-xs font-sans text-muted-foreground">{suffix}</span>
        </p>
        {breakdown && breakdown.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {breakdown.map((b) => (
              <li key={b.label} className="flex justify-between gap-2 tabular-nums">
                <span className="truncate">{b.label}</span>
                <span
                  className={
                    b.tone === "good"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : b.tone === "bad"
                        ? "text-destructive"
                        : ""
                  }
                >
                  {b.value}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
