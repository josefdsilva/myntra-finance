import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import { money } from "@/lib/format";
import { computeBenchmarkComparison } from "@/lib/benchmarks";

type Props = {
  householdId: string;
  monthlyIncome: number;
  monthlySpend: number;
  /** Monthly-averaged spend per app-category key. */
  spendByCategory: Record<string, number>;
};

export function BenchmarksCard({
  householdId,
  monthlyIncome,
  monthlySpend,
  spendByCategory,
}: Props) {
  const { data: hh } = useQuery({
    enabled: !!householdId,
    queryKey: ["household-demographics", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("households")
        .select("country, adults, children")
        .eq("id", householdId)
        .maybeSingle();
      if (error) throw error;
      return data as { country: string; adults: number; children: number } | null;
    },
  });

  const country = hh?.country ?? "PT";
  const adults = hh?.adults ?? 2;
  const children = hh?.children ?? 0;

  const comp = useMemo(
    () =>
      computeBenchmarkComparison({
        country,
        adults,
        children,
        monthlyIncome,
        monthlySpend,
        spendByCategory,
      }),
    [country, adults, children, monthlyIncome, monthlySpend, spendByCategory],
  );

  const flagged = comp.categories.filter((c) => c.flagged).slice(0, 6);
  const savingsDelta =
    comp.savingsRatePct != null ? comp.savingsRatePct - comp.nationalSavingsRatePct : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Benchmarks · {comp.countryName}</CardTitle>
        <CardDescription>
          How your household compares against national statistics for {adults}{" "}
          {adults === 1 ? "adult" : "adults"}
          {children > 0 ? ` + ${children} ${children === 1 ? "child" : "children"}` : ""}. Static
          reference data ({comp.sourceYear}), not other users' data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {monthlyIncome <= 0 ? (
          <p className="text-sm text-muted-foreground">
            Record at least one salary to see how your income and spending compare.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <MetricTile
                label="Income percentile"
                value={`${ordinal(comp.incomePercentile)}`}
                sub={`vs ${comp.countryName} equivalised deciles`}
                accent={
                  comp.incomePercentile >= 70
                    ? "up"
                    : comp.incomePercentile <= 30
                      ? "down"
                      : "neutral"
                }
              />
              <MetricTile
                label="Savings rate"
                value={comp.savingsRatePct != null ? `${comp.savingsRatePct.toFixed(1)}%` : "—"}
                sub={
                  savingsDelta != null
                    ? `${savingsDelta >= 0 ? "+" : ""}${savingsDelta.toFixed(1)} pp vs nat. avg ${comp.nationalSavingsRatePct}%`
                    : `nat. avg ${comp.nationalSavingsRatePct}%`
                }
                accent={
                  savingsDelta == null ? "neutral" : savingsDelta >= 0 ? "up" : "down"
                }
              />
              <MetricTile
                label="Monthly spend"
                value={money(comp.monthlySpend)}
                sub={`nat. avg ${money(comp.nationalAvgMonthlyExpenditure)}`}
                accent={
                  comp.monthlySpend <= comp.nationalAvgMonthlyExpenditure * 1.05 ? "up" : "down"
                }
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-sm font-medium">Category deviations vs national mix</h4>
                <span className="text-xs text-muted-foreground">
                  (share of your spend vs typical Portuguese household)
                </span>
              </div>
              {flagged.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Your category mix is within ±30% of the national average — nothing unusual to
                  flag.
                </p>
              ) : (
                <ul className="divide-y">
                  {flagged.map((c) => (
                    <li
                      key={c.category}
                      className="py-2 flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="capitalize font-medium truncate">{c.category}</div>
                        <div className="text-xs text-muted-foreground">
                          You: {c.userSharePct.toFixed(1)}% ({money(c.userMonthly)}/mo) · Nat:{" "}
                          {c.benchmarkSharePct.toFixed(1)}% ({money(c.benchmarkMonthly)}/mo)
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          c.deviationPct > 0
                            ? "border-destructive/40 text-destructive"
                            : "border-emerald-500/40 text-emerald-600"
                        }
                      >
                        {c.deviationPct > 0 ? "+" : ""}
                        {c.deviationPct.toFixed(0)}%
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground border-t pt-3">
              <Info className="size-3.5 mt-0.5 shrink-0" />
              <p>
                Benchmarks come from public statistics (Eurostat, INE Portugal) — no data from
                other households is used. Set your country and household size in Settings for a
                more accurate comparison.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MetricTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: "up" | "down" | "neutral";
}) {
  const cls =
    accent === "up"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : accent === "down"
        ? "border-amber-500/40 bg-amber-500/5"
        : "border-border";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-display mt-1 tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
