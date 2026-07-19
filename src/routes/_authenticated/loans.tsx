import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Landmark } from "lucide-react";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { pageShellClass } from "@/components/page-shell";
import { DebtsSection as DebtsSetup } from "@/routes/_authenticated/settings";
import { DebtsSection as DebtsOverview } from "@/components/debts-section";
import { EmptyState } from "@/components/empty-state";

import { debtsQuery } from "@/lib/household-queries";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/loans")({
  head: () => ({ meta: [{ title: "Loans · bynku" }] }),
  component: LoansPage,
});

function LoansPage() {
  const t = useT();
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () => fetchHh({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
  });
  const householdId = hh?.household?.id;

  const debtsQ = householdId ? debtsQuery(householdId) : null;
  const { data: debts } = useQuery({
    queryKey: debtsQ?.queryKey ?? ["household-debts", "none"],
    queryFn: debtsQ?.queryFn ?? (async () => []),
    enabled: !!householdId,
  });
  const isEmpty = !!householdId && (debts?.length ?? 0) === 0;

  return (
    <div className={pageShellClass("3xl")}>
      <header>
        <h1 className="text-3xl md:text-4xl font-display">{t("loans.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("loans.subtitle")}</p>
      </header>
      {isEmpty && (
        <EmptyState
          icon={Landmark}
          title={t("loans.empty.title")}
          description={t("loans.empty.desc")}
        />
      )}
      {householdId && (
        <DebtsOverview householdId={householdId} showMoveFunds={false} showSimulator />
      )}

      {householdId && <DebtsSetup householdId={householdId} />}
    </div>
  );
}
