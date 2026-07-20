import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { bucketBalancesFor, type AccountMovement } from "@/lib/movements";
import { debtLiveSchedule, type Debt } from "@/lib/debt-schedule";

/**
 * Net worth = what you own (assets) + what you've set aside (project balances,
 * i.e. savings & investments) − what you still owe (outstanding loan balances).
 * Cash sitting in the bank account is not tracked by the app, so it is excluded.
 */
export function NetWorthCard({ householdId }: { householdId: string }) {
  const t = useT();

  const { data } = useQuery({
    queryKey: ["net-worth", householdId],
    queryFn: async () => {
      const [{ data: assets }, { data: buckets }, { data: allocs }, { data: moves }, { data: debts }] =
        await Promise.all([
          supabase.from("assets").select("current_value, bucket_id").eq("household_id", householdId),
          supabase.from("buckets").select("id, initial_balance").eq("household_id", householdId),
          supabase.from("bucket_allocations").select("bucket_id, amount").eq("household_id", householdId),
          supabase.from("account_movements").select("*").eq("household_id", householdId),
          supabase.from("debts").select("*").eq("household_id", householdId),
        ]);

      const assetsTotal = (assets ?? []).reduce((s, a) => s + Number(a.current_value), 0);
      const balances = bucketBalancesFor(
        buckets ?? [],
        allocs ?? [],
        (moves ?? []) as AccountMovement[],
      );
      // A project linked to an asset is already counted as that asset, so its
      // balance must not also count as savings (would double-count net worth).
      const linkedBucketIds = new Set(
        (assets ?? []).map((a) => a.bucket_id).filter((x): x is string => !!x),
      );
      const savings = Object.entries(balances).reduce(
        (s, [id, v]) => (linkedBucketIds.has(id) ? s : s + v),
        0,
      );
      const debtTotal = ((debts ?? []) as Debt[]).reduce(
        (s, d) => s + debtLiveSchedule(d).remaining,
        0,
      );
      return {
        assetsTotal,
        savings,
        debtTotal,
        net: assetsTotal + savings - debtTotal,
      };
    },
  });

  if (!data) return null;
  // Nothing to show until there's at least one moving part.
  if (data.assetsTotal === 0 && data.savings === 0 && data.debtTotal === 0) return null;

  const rows: Array<{ label: string; value: number; sign: 1 | -1 }> = [
    { label: t("netWorth.assets"), value: data.assetsTotal, sign: 1 },
    { label: t("netWorth.savings"), value: data.savings, sign: 1 },
    { label: t("netWorth.loans"), value: data.debtTotal, sign: -1 },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>{t("netWorth.title")}</CardTitle>
        <CardDescription>
          <span
            className={`text-2xl font-display tabular-nums ${data.net >= 0 ? "text-foreground" : "text-destructive"}`}
          >
            {money(data.net)}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 p-2.5 sm:block"
            >
              <p className="text-xs text-muted-foreground">{r.label}</p>
              <p
                className={`tabular-nums font-medium whitespace-nowrap ${r.sign < 0 ? "text-destructive" : "text-foreground"}`}
              >
                {r.sign < 0 ? "−" : ""}
                {money(r.value)}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("netWorth.hint")}</p>
      </CardContent>
    </Card>
  );
}
