import { pageMeta } from "@/lib/route-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { pageShellClass } from "@/components/page-shell";
import { KpiTargetsTab } from "@/components/kpi-targets-tab";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/targets")({
  head: () =>
    pageMeta({
      path: "/targets",
      title: "Targets · bynku",
      description: "Set and follow the financial targets that move your household forward.",
      noindex: true,
    }),
  component: TargetsPage,
});

function TargetsPage() {
  const t = useT();
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () => fetchHh({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
  });
  const householdId = hh?.household?.id;

  return (
    <main className={pageShellClass("5xl")}>
      <header>
        <h1 className="text-3xl md:text-4xl font-display">{t("alloc.tab.targets")}</h1>
        <p className="text-sm text-muted-foreground">{t("targets.subtitle")}</p>
      </header>
      {householdId && <KpiTargetsTab householdId={householdId} />}
    </main>
  );
}
