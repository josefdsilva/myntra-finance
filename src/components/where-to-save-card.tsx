import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { computeBenchmarkComparison, hasBenchmark } from "@/lib/benchmarks";
import { findSavings } from "@/lib/savings-finder";

/**
 * "Where to save" — the deep home of the tight-budget savings finder. Reuses the
 * per-category peer benchmark comparison and the shared `findSavings` engine to
 * answer "which €X to cut" with concrete, ranked category trims. Self-gates: it
 * only renders for a household that's genuinely tight (via `findSavings.surface`)
 * and never for business spaces or countries without benchmark data. Respectful
 * by design — it suggests closing part of the gap to peers, not going without.
 */
export function WhereToSaveCard({
  householdId,
  monthlyIncome,
  monthlySpend,
  spendByCategory,
  surplus,
}: {
  householdId: string;
  monthlyIncome: number;
  monthlySpend: number;
  spendByCategory: Record<string, number>;
  surplus: number;
}) {
  const t = useT();
  const { data: hh } = useQuery({
    queryKey: ["where-to-save-hh", householdId],
    queryFn: async () => {
      const { data } = await supabase
        .from("households")
        .select("country, adults, children, kind, age_band, margin_pct")
        .eq("id", householdId)
        .maybeSingle();
      return data;
    },
  });

  const country = hh?.country ?? null;
  const isBusiness = hh?.kind === "business";
  const adults = Number(hh?.adults ?? 2);
  const children = Number(hh?.children ?? 0);
  const ageBand = (hh?.age_band as string | null) ?? null;
  const marginPct = Number(hh?.margin_pct ?? 10);

  const comp = useMemo(
    () =>
      country && hasBenchmark(country) && !isBusiness
        ? computeBenchmarkComparison({
            country,
            adults,
            children,
            monthlyIncome,
            monthlySpend,
            spendByCategory,
          })
        : null,
    [country, isBusiness, adults, children, monthlyIncome, monthlySpend, spendByCategory],
  );

  if (!comp) return null;

  const categoryOver = comp.categories
    .filter((c) => c.diffEur > 5)
    .map((c) => ({ category: c.category, overMonthly: c.diffEur }));
  const savings = findSavings({
    income: monthlyIncome,
    surplus,
    marginPct,
    ageBand,
    incomeQuintile: comp.incomeQuintile,
    categoryOver,
  });

  if (!savings.surface || savings.spending.length === 0) return null;

  const byCat = new Map(comp.categories.map((c) => [c.category, c]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="size-4 text-primary" /> {t("ana.save.title")}
        </CardTitle>
        <CardDescription>{t("ana.save.intro", { gap: money(savings.gapEur) })}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {savings.spending.map((s) => {
            if (s.kind !== "category") return null;
            const c = byCat.get(s.category);
            return (
              <li
                key={s.category}
                className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium capitalize">{s.category}</span>
                  <span className="shrink-0 tabular-nums font-medium text-amber-700 dark:text-amber-300">
                    {t("ana.save.trim", { amount: money(s.monthlyEur) })}
                  </span>
                </div>
                {c && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("ana.save.detail", {
                      user: money(c.userMonthly),
                      benchmark: money(c.benchmarkMonthly),
                    })}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">{t("ana.save.footer")}</p>
      </CardContent>
    </Card>
  );
}
