import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { pageShellClass } from "@/components/page-shell";
import { IncomesSection } from "@/routes/_authenticated/settings";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/money-in")({
  head: () => ({ meta: [{ title: "Money in · bynku" }] }),
  component: MoneyInPage,
});

function MoneyInPage() {
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
        <h1 className="text-3xl md:text-4xl font-display">{t("moneyIn.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("moneyIn.subtitle")}</p>
      </header>
      {householdId && <IncomesSection householdId={householdId} />}
    </div>
  );
}
