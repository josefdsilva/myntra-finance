import { pageMeta } from "@/lib/route-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
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
import { cycleForSpace } from "@/lib/cadence";
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
  const cycle = cycleForSpace(hh?.household);
  const baseline = Number(hh?.household?.baseline_budget ?? 0);

  const { lens: lensParam } = Route.useSearch();
  const [lens, setLens] = useState<"recurring" | "cycle" | "planned">(lensParam ?? "cycle");

  return (
    <div className={pageShellClass("5xl")}>
      <header>
        <h1 className="text-3xl md:text-4xl font-display">{t("cashflow.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("cashflow.subtitle")}</p>
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
          {householdId && (
            <IncomesSection householdId={householdId} cycle={cycle} />
          )}
          {householdId && <FixedExpensesSection householdId={householdId} cycle={cycle} />}
          {householdId && <VariableEstimatesSection householdId={householdId} />}
        </>
      )}

      {/* This-cycle lens: expected (incl. debt) vs what actually happened. */}
      {lens === "cycle" && (
        <>
          {householdId && (
            <CommittedThisCycle householdId={householdId} cycle={cycle} />
          )}
          {householdId && <SpendingVsEstimate householdId={householdId} />}
          {householdId && <PlannedThisCycle householdId={householdId} />}
        </>
      )}

      {/* Planned lens: dated one-offs and the forward forecast, fully in-hub. */}
      {lens === "planned" && householdId && (
        <PlanPanel householdId={householdId} baseline={baseline} />
      )}
    </div>
  );
}

