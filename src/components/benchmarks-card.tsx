import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
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

  const householdLabel = `${adults} ${adults === 1 ? "adult" : "adults"}${
    children > 0 ? ` + ${children} ${children === 1 ? "child" : "children"}` : ""
  }`;

  const incomeStory = describeIncome(comp.incomePercentile, comp.countryName, householdLabel);
  const savingsStory =
    comp.savingsRatePct != null
      ? describeSavings(comp.savingsRatePct, comp.nationalSavingsRatePct, comp.countryName)
      : null;
  const spendStory = describeSpend(
    comp.monthlySpend,
    comp.nationalAvgMonthlyExpenditure,
    comp.countryName,
    householdLabel,
  );

  const flagged = comp.categories.filter((c) => c.flagged).slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle>How you compare · {comp.countryName}</CardTitle>
        <CardDescription>
          Plain-English comparison against national statistics for a household of {householdLabel}.
          Public reference data ({comp.sourceYear}) — never other users&apos; data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {monthlyIncome <= 0 ? (
          <p className="text-sm text-muted-foreground">
            Record at least one salary to see how your income and spending compare.
          </p>
        ) : (
          <>
            <StoryTile tone={incomeStory.tone} headline={incomeStory.headline} detail={incomeStory.detail} />
            {savingsStory && (
              <StoryTile tone={savingsStory.tone} headline={savingsStory.headline} detail={savingsStory.detail} />
            )}
            <StoryTile tone={spendStory.tone} headline={spendStory.headline} detail={spendStory.detail} />

            <div>
              <h4 className="text-sm font-medium mb-2">Where your spending stands out</h4>
              {flagged.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Your category mix looks typical — nothing more than ~30% away from the national
                  average.
                </p>
              ) : (
                <ul className="space-y-2">
                  {flagged.map((c) => {
                    const higher = c.deviationPct > 0;
                    const diffAbs = Math.abs(c.userMonthly - c.benchmarkMonthly);
                    const multiple = c.benchmarkMonthly > 0 ? c.userMonthly / c.benchmarkMonthly : 0;
                    const ratioLabel =
                      multiple >= 1.5
                        ? `${multiple.toFixed(1)}× the national average`
                        : multiple > 0 && multiple <= 0.7
                          ? `about ${Math.round((1 - multiple) * 100)}% below the national average`
                          : `${Math.abs(c.deviationPct).toFixed(0)}% ${higher ? "above" : "below"} the national average`;
                    return (
                      <li
                        key={c.category}
                        className={`rounded-lg border p-3 text-sm ${
                          higher
                            ? "border-amber-500/40 bg-amber-500/5"
                            : "border-emerald-500/30 bg-emerald-500/5"
                        }`}
                      >
                        <div className="capitalize font-medium">
                          {c.category} is {ratioLabel}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          You spend about {money(c.userMonthly)}/mo; typical {comp.countryName}{" "}
                          household of your size spends {money(c.benchmarkMonthly)}/mo.
                          {higher
                            ? ` Cutting to the average would free ~${money(diffAbs)}/mo.`
                            : ` You save ~${money(diffAbs)}/mo vs the average here.`}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground border-t pt-3">
              <Info className="size-3.5 mt-0.5 shrink-0" />
              <p>
                Based on public statistics (Eurostat, INE Portugal). Adjust your country and
                household size in Settings for a more accurate comparison.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

type Tone = "up" | "down" | "neutral";

function StoryTile({
  tone,
  headline,
  detail,
}: {
  tone: Tone;
  headline: string;
  detail: string;
}) {
  const cls =
    tone === "up"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : tone === "down"
        ? "border-amber-500/40 bg-amber-500/5"
        : "border-border";
  const Icon = tone === "up" ? TrendingUp : tone === "down" ? TrendingDown : Minus;
  const iconCls =
    tone === "up" ? "text-emerald-600" : tone === "down" ? "text-amber-600" : "text-muted-foreground";
  return (
    <div className={`rounded-lg border p-3 flex gap-3 ${cls}`}>
      <Icon className={`size-4 mt-0.5 shrink-0 ${iconCls}`} />
      <div className="min-w-0">
        <div className="text-sm font-medium">{headline}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{detail}</div>
      </div>
    </div>
  );
}

function describeIncome(percentile: number, countryName: string, householdLabel: string) {
  // Percentile = share of households at or below your income.
  const topPct = Math.max(1, Math.round(100 - percentile));
  const bottomPct = Math.max(1, Math.round(percentile));
  let headline: string;
  let tone: Tone;
  if (percentile >= 90) {
    headline = `Your income is in the top ${topPct}% of ${countryName} households your size.`;
    tone = "up";
  } else if (percentile >= 70) {
    headline = `Your income is in the top ${topPct}% of ${countryName} households your size.`;
    tone = "up";
  } else if (percentile >= 45 && percentile <= 55) {
    headline = `Your income is right around the median for ${countryName} households your size.`;
    tone = "neutral";
  } else if (percentile >= 30) {
    headline = `Your income is a bit below the median for ${countryName} households your size.`;
    tone = "neutral";
  } else {
    headline = `Your income is in the bottom ${bottomPct}% of ${countryName} households your size.`;
    tone = "down";
  }
  const detail = `Compared with ${householdLabel} across ${countryName}, roughly ${bottomPct}% earn less than you and ${topPct}% earn more (adjusted for household size).`;
  return { tone, headline, detail };
}

function describeSavings(userPct: number, nationalPct: number, countryName: string) {
  const delta = userPct - nationalPct;
  let headline: string;
  let tone: Tone;
  if (userPct < 0) {
    headline = `You&apos;re spending more than you earn (${userPct.toFixed(1)}% savings rate).`;
    tone = "down";
  } else if (delta >= 5) {
    headline = `You save ${userPct.toFixed(1)}% of income — well above the ${countryName} average of ${nationalPct}%.`;
    tone = "up";
  } else if (delta >= -2) {
    headline = `You save ${userPct.toFixed(1)}% of income — about the same as the ${countryName} average (${nationalPct}%).`;
    tone = "neutral";
  } else {
    headline = `You save ${userPct.toFixed(1)}% of income — below the ${countryName} average of ${nationalPct}%.`;
    tone = "down";
  }
  const detail =
    delta >= 0
      ? `That&apos;s ${delta.toFixed(1)} percentage points above average — a stronger cushion than most households.`
      : `That&apos;s ${Math.abs(delta).toFixed(1)} percentage points below average — closing the gap would strengthen your buffer.`;
  // Fix stray &apos; entities (JSX renders literal string) — replace with actual char.
  return {
    tone,
    headline: headline.replace(/&apos;/g, "\u2019"),
    detail: detail.replace(/&apos;/g, "\u2019"),
  };
}

function describeSpend(
  userSpend: number,
  natSpend: number,
  countryName: string,
  householdLabel: string,
) {
  const ratio = natSpend > 0 ? userSpend / natSpend : 1;
  const diff = userSpend - natSpend;
  let headline: string;
  let tone: Tone;
  if (ratio <= 0.9) {
    const pct = Math.round((1 - ratio) * 100);
    headline = `You spend about ${pct}% less per month than the typical ${countryName} household your size.`;
    tone = "up";
  } else if (ratio <= 1.1) {
    headline = `Your monthly spending is about average for ${countryName} households your size.`;
    tone = "neutral";
  } else {
    const pct = Math.round((ratio - 1) * 100);
    headline = `You spend about ${pct}% more per month than the typical ${countryName} household your size.`;
    tone = "down";
  }
  const detail = `You: ${money(userSpend)}/mo · Typical ${householdLabel} in ${countryName}: ${money(
    natSpend,
  )}/mo (${diff >= 0 ? "+" : "−"}${money(Math.abs(diff))}).`;
  return { tone, headline, detail };
}
