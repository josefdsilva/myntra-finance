import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { money } from "@/lib/format";
import { useT, type MessageKey } from "@/lib/i18n";
import { computeBenchmarkComparison, hasBenchmark } from "@/lib/benchmarks";
import { findSavings } from "@/lib/savings-finder";
import { cycleForSpace, perCycleFromMonthly } from "@/lib/cadence";
import { resolveIntent, defaultIntentForCategory } from "@/lib/intent";

// Only these intents are ever suggested for cutting — never essentials
// (housing, kids, groceries, health, utilities, transport) and never
// "important" (fuel, insurance). Suggesting a tight family cut their kids or
// their home is exactly the mistake this fixes.
const DISCRETIONARY = new Set(["nice_to_have", "treat"]);

/**
 * "Where to save" — the deep home of the tight-budget savings finder. It ranks
 * DISCRETIONARY spending (nice-to-have + treat), fixed and variable, largest
 * first — including subscriptions — and suggests trimming a third of each. It
 * never proposes cutting essentials, and only renders for a household that's
 * genuinely tight (via `findSavings.surface`), never for business spaces.
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
        .select("country, adults, children, kind, age_band, margin_pct, cycle")
        .eq("id", householdId)
        .maybeSingle();
      return data;
    },
  });
  const { data: fixedRows } = useQuery({
    queryKey: ["where-to-save-fixed", householdId],
    queryFn: async () => {
      const { data } = await supabase
        .from("fixed_expenses")
        .select("category, intent, monthly_amount")
        .eq("household_id", householdId);
      return data ?? [];
    },
  });

  const country = hh?.country ?? null;
  const isBusiness = hh?.kind === "business";
  const adults = Number(hh?.adults ?? 2);
  const children = Number(hh?.children ?? 0);
  const ageBand = (hh?.age_band as string | null) ?? null;
  const marginPct = Number(hh?.margin_pct ?? 10);

  // Peer comparison is optional context (shown per row when available). It also
  // supplies the income quintile for the income-side nudge.
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

  if (isBusiness) return null;

  // Discretionary spend per category — fixed (by its intent) + variable (by the
  // category's default intent). Essentials/important are excluded.
  const catSpend: Record<string, number> = {};
  for (const r of fixedRows ?? []) {
    const level = resolveIntent({ intent: r.intent, category: r.category });
    if (DISCRETIONARY.has(level) && r.category) {
      catSpend[r.category] = (catSpend[r.category] ?? 0) + (Number(r.monthly_amount) || 0);
    }
  }
  for (const [cat, amt] of Object.entries(spendByCategory)) {
    if (DISCRETIONARY.has(defaultIntentForCategory(cat))) {
      catSpend[cat] = (catSpend[cat] ?? 0) + amt;
    }
  }
  const categoryCuts = Object.entries(catSpend).map(([category, monthly]) => ({ category, monthly }));

  const savings = findSavings({
    income: monthlyIncome,
    surplus,
    marginPct,
    ageBand,
    incomeQuintile: comp?.incomeQuintile ?? null,
    categoryCuts,
  });

  if (!savings.surface || savings.spending.length === 0) return null;

  const byCat = new Map((comp?.categories ?? []).map((c) => [c.category, c]));
  const cycle = cycleForSpace(hh);
  const per = t(`period.per.${cycle}` as MessageKey);
  const cyc = (m: number) => money(perCycleFromMonthly(m, cycle));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="size-4 text-primary" /> {t("ana.save.title")}
        </CardTitle>
        <CardDescription>{t("ana.save.intro", { gap: cyc(savings.gapEur) })}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {savings.spending.map((s) => {
            if (s.kind !== "category") return null;
            const c = byCat.get(s.category);
            const overPeer = c && c.userMonthly > c.benchmarkMonthly;
            return (
              <li
                key={s.category}
                className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium capitalize">{s.category}</span>
                  <span className="shrink-0 tabular-nums font-medium text-amber-700 dark:text-amber-300">
                    {t("ana.save.trim", { amount: cyc(s.monthlyEur), per })}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {overPeer
                    ? t("ana.save.detail", {
                        user: cyc(c!.userMonthly),
                        per,
                        benchmark: cyc(c!.benchmarkMonthly),
                      })
                    : t("ana.save.detailPlain", { amount: cyc(catSpend[s.category] ?? 0), per })}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">{t("ana.save.footer")}</p>
      </CardContent>
    </Card>
  );
}
