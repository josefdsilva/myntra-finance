import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { useT } from "@/lib/i18n";
import { StatementImportFlow } from "@/components/statement-import-flow";

export const Route = createFileRoute("/_authenticated/statement-import")({
  head: () => ({ meta: [{ title: "Import statement · bynku" }] }),
  component: StatementImportPage,
});

function StatementImportPage() {
  const t = useT();
  const navigate = useNavigate();
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () => fetchHh({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
  });
  const householdId = hh?.household?.id;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-display">{t("stmt.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("stmt.subtitle")}</p>
      </header>
      {householdId && (
        <StatementImportFlow householdId={householdId} onApplied={() => navigate({ to: "/settings" })} />
      )}
    </div>
  );
}
