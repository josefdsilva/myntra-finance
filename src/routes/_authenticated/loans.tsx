import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { pageShellClass } from "@/components/page-shell";
import { DebtsSection as DebtsSetup } from "@/routes/_authenticated/settings";
import { DebtsSection as DebtsOverview } from "@/components/debts-section";
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

  return (
    <div className={pageShellClass("3xl")}>
      <header>
        <h1 className="text-3xl md:text-4xl font-display">{t("loans.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("loans.subtitle")}</p>
      </header>
      {householdId && <DebtsOverview householdId={householdId} showMoveFunds={false} />}
      {householdId && <DebtsSetup householdId={householdId} />}
    </div>
  );
}
