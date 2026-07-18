import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { pageShellClass } from "@/components/page-shell";
import { IncomesSection } from "@/routes/_authenticated/settings";
import { useT } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { money, fmtDate } from "@/lib/format";

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
      {householdId && <IncomeHistorySection householdId={householdId} />}
    </div>
  );
}

function IncomeHistorySection({ householdId }: { householdId: string }) {
  const t = useT();
  const { data: rows } = useQuery({
    queryKey: ["income-history", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, amount, occurred_at, merchant, note, category")
        .eq("household_id", householdId)
        .eq("kind", "income")
        .order("occurred_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = (rows ?? []).reduce((s, r) => s + Number(r.amount), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("moneyIn.historyTitle")}</CardTitle>
        <CardDescription>
          {rows && rows.length > 0
            ? t("moneyIn.historyEntries", { count: rows.length, value: money(total) })
            : t("moneyIn.historyDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!rows?.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {t("moneyIn.historyEmpty")}
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    {r.merchant || r.note || r.category}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(r.occurred_at)} · {r.category}
                  </p>
                </div>
                <p className="font-medium tabular-nums text-primary shrink-0">
                  +{money(r.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
