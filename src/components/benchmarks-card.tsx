import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { money } from "@/lib/format";
import {
  computeBenchmarkComparison,
  computeWealthComparison,
  computeDebtServiceComparison,
  hasBenchmark,
  supportedBenchmarkCountries,
  type BenchmarkComparison,
  type WealthComparison,
  type DebtServiceComparison,
  type AgeBand,
} from "@/lib/benchmarks";
import { bucketBalancesFor, type AccountMovement } from "@/lib/movements";
import { debtLiveSchedule, type Debt } from "@/lib/debt-schedule";
import { useT, type MessageKey } from "@/lib/i18n";

type T = ReturnType<typeof useT>;

type Props = {
  householdId: string;
  monthlyIncome: number;
  monthlySpend: number;
  /** Monthly-averaged spend per app-category key. */
  spendByCategory: Record<string, number>;
  /**
   * How complete the spending picture is (0..1). A still-running cycle on day 1
   * has almost no spend, so comparing it to a full-cycle benchmark is misleading
   * ("100% below average"). Below a threshold we hold the spend-based comparisons
   * until enough of the cycle has passed. Defaults to fully representative.
   */
  progress?: number;
};

/** Show spend-based comparisons only once the cycle is at least a third in. */
const REPRESENTATIVE_THRESHOLD = 1 / 3;

export function BenchmarksCard({
  householdId,
  monthlyIncome,
  monthlySpend,
  spendByCategory,
  progress = 1,
}: Props) {
  const t = useT();
  const { data: hh, isLoading: hhLoading } = useQuery({
    enabled: !!householdId,
    queryKey: ["household-demographics", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("households")
        .select("country, adults, children, kind, age_band")
        .eq("id", householdId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        country: string;
        adults: number;
        children: number;
        kind: string | null;
        age_band: string | null;
      } | null;
    },
  });

  // Net worth (own definition matches NetWorthCard: assets + project balances -
  // live debt) and the monthly debt-service load, for the HFCS comparisons.
  const { data: position } = useQuery({
    enabled: !!householdId,
    queryKey: ["benchmark-position", householdId],
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
      const balances = bucketBalancesFor(buckets ?? [], allocs ?? [], (moves ?? []) as AccountMovement[]);
      const linkedBucketIds = new Set(
        (assets ?? []).map((a) => a.bucket_id).filter((x): x is string => !!x),
      );
      const savings = Object.entries(balances).reduce(
        (s, [id, v]) => (linkedBucketIds.has(id) ? s : s + v),
        0,
      );
      const debtList = ((debts ?? []) as Debt[]).map((d) => debtLiveSchedule(d));
      const debtTotal = debtList.reduce((s, d) => s + d.remaining, 0);
      const monthlyDebtService = debtList.reduce((s, d) => s + d.installment, 0);
      return {
        netWorth: assetsTotal + savings - debtTotal,
        monthlyDebtService,
        hasParts: assetsTotal !== 0 || savings !== 0 || debtTotal !== 0,
      };
    },
  });

  // Never assume a country. If the household has none, or one we don't curate,
  // we show a clear "not available" state instead of silently comparing them to
  // some other country's data.
  const country = hh?.country ?? null;
  const adults = hh?.adults ?? 2;
  const children = hh?.children ?? 0;
  const supported = hasBenchmark(country);

  const { data: latestVersions } = useQuery({
    enabled: supported,
    queryKey: ["benchmark-versions"],
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch("/api/public/benchmarks-version");
      if (!res.ok) return null;
      return (await res.json()) as Record<string, number>;
    },
  });

  const comp = useMemo(
    () =>
      supported
        ? computeBenchmarkComparison({
            country: country ?? "",
            adults,
            children,
            monthlyIncome,
            monthlySpend,
            spendByCategory,
          })
        : null,
    [supported, country, adults, children, monthlyIncome, monthlySpend, spendByCategory],
  );

  const ageBand = (hh?.age_band ?? null) as AgeBand | null;

  const wealthComp = useMemo(
    () =>
      supported && position?.hasParts
        ? computeWealthComparison({
            country: country ?? "",
            userNetWorth: position.netWorth,
            incomeQuintile: comp?.incomeQuintile ?? null,
            ageBand,
          })
        : null,
    [supported, position?.hasParts, position?.netWorth, country, comp?.incomeQuintile, ageBand],
  );

  const debtComp = useMemo(
    () =>
      supported && position && position.monthlyDebtService > 0
        ? computeDebtServiceComparison({
            country: country ?? "",
            monthlyDebtService: position.monthlyDebtService,
            monthlyIncome,
          })
        : null,
    [supported, position, country, monthlyIncome],
  );

  // While demographics are loading, render nothing rather than flashing the
  // "not available" state.
  if (hhLoading) return null;

  if (!supported || !comp) {
    const supportedList = supportedBenchmarkCountries();
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("benchmarks.title")}</CardTitle>
          <CardDescription>
            {country ? t("benchmarks.notSupported", { country }) : t("benchmarks.noCountry")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t("benchmarks.notSupportedBody")}</p>
          <p className="text-foreground">
            {supportedList.map((c) => `${c.name} (${c.code})`).join(" · ")}
          </p>
          <div className="flex items-start gap-2 text-xs border-t pt-3">
            <Info className="size-3.5 mt-0.5 shrink-0" />
            <p>{t("benchmarks.disclaimer")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const householdLabel = `${adults} ${adults === 1 ? t("benchmarks.adult") : t("benchmarks.adults")}${
    children > 0
      ? ` + ${children} ${children === 1 ? t("benchmarks.child") : t("benchmarks.children")}`
      : ""
  }`;

  const bandName = t(comp.bandKey as MessageKey);

  const newerAvailable =
    latestVersions && latestVersions[comp.country] && latestVersions[comp.country] > comp.sourceYear
      ? latestVersions[comp.country]
      : null;

  const incomeStory = describeIncome(t, comp.incomePercentile, comp.countryName, householdLabel);
  const savingsStory =
    comp.savingsRatePct != null
      ? describeSavings(t, comp.savingsRatePct, comp.nationalSavingsRatePct, comp.countryName)
      : null;
  const spendStory = describeSpend(t, comp.monthlySpend, comp.expectedMonthlySpend, bandName);
  const wealthStory = wealthComp ? describeWealth(t, wealthComp, comp.countryName) : null;
  const debtStory = debtComp ? describeDebt(t, debtComp) : null;

  // Early in a running cycle there's too little spend for a fair comparison, so
  // hold the spend/savings stories and the standouts until the cycle fills in.
  const representative = progress >= REPRESENTATIVE_THRESHOLD;
  const flagged = comp.categories.filter((c) => c.flagged).slice(0, 6);
  const lowCoverage = comp.coveragePct < 70;
  const excludedLabel = comp.excludedCategories
    .map((e) => `${e.category} (${money(e.userMonthly)})`)
    .join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("benchmarks.titleWithCountry", { country: comp.countryName })}</CardTitle>
        <CardDescription>
          {t("benchmarks.description", { household: householdLabel, year: comp.sourceYear })}{" "}
          {t("benchmarks.bandContext", { band: bandName, country: comp.countryName })}
          {newerAvailable && (
            <>
              {" "}
              <span className="text-amber-600">
                {t("benchmarks.newerDataAvailable", { year: newerAvailable })}
              </span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <MarketSnapshot t={t} macro={comp.macro} countryName={comp.countryName} />

        {monthlyIncome <= 0 ? (
          <p className="text-sm text-muted-foreground">{t("benchmarks.needSalary")}</p>
        ) : (
          <>
            <StoryTile
              tone={incomeStory.tone}
              headline={incomeStory.headline}
              detail={incomeStory.detail}
            />

            {wealthStory && (
              <StoryTile
                tone={wealthStory.tone}
                headline={wealthStory.headline}
                detail={wealthStory.detail}
              />
            )}
            {wealthComp && wealthComp.ageBand == null && (
              <p className="text-xs text-muted-foreground -mt-2">
                {t("benchmarks.wealthAgeHint")}
              </p>
            )}
            {debtStory && (
              <StoryTile
                tone={debtStory.tone}
                headline={debtStory.headline}
                detail={debtStory.detail}
              />
            )}

            {!representative ? (
              <StoryTile
                tone="neutral"
                headline={t("benchmarks.tooEarlyTitle")}
                detail={t("benchmarks.tooEarlyBody")}
              />
            ) : (
              <>
                {savingsStory && (
                  <StoryTile
                    tone={savingsStory.tone}
                    headline={savingsStory.headline}
                    detail={savingsStory.detail}
                  />
                )}
                {savingsStory && (
                  <p className="text-xs text-muted-foreground -mt-2">
                    {t("benchmarks.investNote")}
                  </p>
                )}
                <StoryTile
                  tone={spendStory.tone}
                  headline={spendStory.headline}
                  detail={spendStory.detail}
                />
              </>
            )}

            <div>
              <h4 className="text-sm font-medium mb-2">{t("benchmarks.spendingStandsOut")}</h4>
              {!representative ? (
                <p className="text-sm text-muted-foreground">
                  {t("benchmarks.tooEarlyStandouts")}
                </p>
              ) : flagged.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("benchmarks.typicalMix")}</p>
              ) : (
                <ul className="space-y-2">
                  {flagged.map((c) => {
                    const higher = c.diffEur > 0;
                    const diffAbs = Math.abs(c.userMonthly - c.benchmarkMonthly);
                    const multiple =
                      c.benchmarkMonthly > 0 ? c.userMonthly / c.benchmarkMonthly : 0;
                    const ratioLabel =
                      multiple >= 1.5
                        ? t("benchmarks.ratioMultiple", { multiple: multiple.toFixed(1) })
                        : multiple > 0 && multiple <= 0.7
                          ? t("benchmarks.ratioBelow", {
                              pct: Math.round((1 - multiple) * 100),
                            })
                          : t("benchmarks.ratioDeviation", {
                              pct: Math.abs(c.deviationPct ?? 0).toFixed(0),
                              direction: higher ? t("benchmarks.above") : t("benchmarks.below"),
                            });
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
                          {t("benchmarks.categoryIs", { category: c.category, ratioLabel })}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {t("benchmarks.spendDetail", {
                            user: money(c.userMonthly),
                            country: comp.countryName,
                            benchmark: money(c.benchmarkMonthly),
                          })}
                          {higher
                            ? t("benchmarks.cuttingFree", { amount: money(diffAbs) })
                            : t("benchmarks.saveVsAverage", { amount: money(diffAbs) })}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {t("benchmarks.coverageNote", { pct: comp.coveragePct })}
              {lowCoverage ? ` ${t("benchmarks.coverageLow")}` : ""}
            </p>

            {comp.excludedCategories.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t(debtComp ? "benchmarks.excludedNote" : "benchmarks.excludedNoteNoDebt", {
                  list: excludedLabel,
                })}
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              {t("benchmarks.upliftNote", { year: comp.expenditureSurveyYear })}
            </p>

            <div className="flex items-start gap-2 text-xs text-muted-foreground border-t pt-3">
              <Info className="size-3.5 mt-0.5 shrink-0" />
              <p>{t("benchmarks.methodologyNote")}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Render a "YYYY-MM" reference period as a short "Mon YYYY" label. */
function formatMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  try {
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });
  } catch {
    return ym;
  }
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border p-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

/**
 * Market-wide indicators for the household's country (inflation, unemployment)
 * plus the eurozone Euribor rates. Independent of the user's own numbers, so it
 * shows even before there's enough spend for the personal comparison.
 */
function MarketSnapshot({
  t,
  macro,
  countryName,
}: {
  t: T;
  macro: BenchmarkComparison["macro"];
  countryName: string;
}) {
  return (
    <div>
      <h4 className="text-sm font-medium mb-2">
        {t("benchmarks.marketSnapshot", { country: countryName })}
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatTile
          label={t("benchmarks.inflation")}
          value={`${macro.inflationRatePct.toFixed(1)}%`}
          sub={t("benchmarks.euroAreaValue", { pct: macro.euroAreaInflationPct.toFixed(1) })}
        />
        <StatTile
          label={t("benchmarks.unemployment")}
          value={`${macro.unemploymentRatePct.toFixed(1)}%`}
          sub={t("benchmarks.euroAreaValue", { pct: macro.euroAreaUnemploymentPct.toFixed(1) })}
        />
        <StatTile label={t("benchmarks.euribor3m")} value={`${macro.euribor3mPct.toFixed(2)}%`} />
        <StatTile label={t("benchmarks.euribor12m")} value={`${macro.euribor12mPct.toFixed(2)}%`} />
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {t("benchmarks.marketAsOf", { date: formatMonth(macro.asOf) })}
      </p>
    </div>
  );
}

type Tone = "up" | "down" | "neutral";

function StoryTile({ tone, headline, detail }: { tone: Tone; headline: string; detail: string }) {
  const cls =
    tone === "up"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : tone === "down"
        ? "border-amber-500/40 bg-amber-500/5"
        : "border-border";
  const Icon = tone === "up" ? TrendingUp : tone === "down" ? TrendingDown : Minus;
  const iconCls =
    tone === "up"
      ? "text-emerald-600"
      : tone === "down"
        ? "text-amber-600"
        : "text-muted-foreground";
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

function describeIncome(t: T, percentile: number, countryName: string, householdLabel: string) {
  // Percentile = share of households at or below your income.
  const topPct = Math.max(1, Math.round(100 - percentile));
  const bottomPct = Math.max(1, Math.round(percentile));
  let headline: string;
  let tone: Tone;
  if (percentile >= 90 || percentile >= 70) {
    headline = t("benchmarks.incomeTopPercentile", { pct: topPct, country: countryName });
    tone = "up";
  } else if (percentile >= 45 && percentile <= 55) {
    headline = t("benchmarks.incomeMedian", { country: countryName });
    tone = "neutral";
  } else if (percentile >= 30) {
    headline = t("benchmarks.incomeBelowMedian", { country: countryName });
    tone = "neutral";
  } else {
    headline = t("benchmarks.incomeBottomPercentile", { pct: bottomPct, country: countryName });
    tone = "down";
  }
  const detail = t("benchmarks.incomeDetail", {
    household: householdLabel,
    country: countryName,
    bottomPct,
    topPct,
  });
  return { tone, headline, detail };
}

function describeSavings(t: T, userPct: number, nationalPct: number, countryName: string) {
  const delta = userPct - nationalPct;
  let headline: string;
  let tone: Tone;
  if (userPct < 0) {
    headline = t("benchmarks.savingsNegative", { pct: userPct.toFixed(1) });
    tone = "down";
  } else if (delta >= 5) {
    headline = t("benchmarks.savingsAboveAvg", {
      pct: userPct.toFixed(1),
      country: countryName,
      avg: nationalPct,
    });
    tone = "up";
  } else if (delta >= -2) {
    headline = t("benchmarks.savingsAboutSame", {
      pct: userPct.toFixed(1),
      country: countryName,
      avg: nationalPct,
    });
    tone = "neutral";
  } else {
    headline = t("benchmarks.savingsBelowAvg", {
      pct: userPct.toFixed(1),
      country: countryName,
      avg: nationalPct,
    });
    tone = "down";
  }
  const detail =
    delta >= 0
      ? t("benchmarks.savingsDetailAbove", { delta: delta.toFixed(1) })
      : t("benchmarks.savingsDetailBelow", { delta: Math.abs(delta).toFixed(1) });
  return { tone, headline, detail };
}

/**
 * Spend is compared against the expected total for a household in the same
 * income band AND the same size (both size-adjusted), not a flat national mean.
 */
function describeWealth(t: T, w: WealthComparison, countryName: string) {
  const ratio = w.peerMedian > 0 ? w.userNetWorth / w.peerMedian : 0;
  let headline: string;
  let tone: Tone;
  if (w.userNetWorth < 0) {
    headline = t("benchmarks.wealthNegative");
    tone = "down";
  } else if (ratio >= 1.1) {
    headline = t("benchmarks.wealthAbove", { pct: Math.round((ratio - 1) * 100) });
    tone = "up";
  } else if (ratio >= 0.9) {
    headline = t("benchmarks.wealthAbout");
    tone = "neutral";
  } else {
    headline = t("benchmarks.wealthBelow", { pct: Math.round((1 - ratio) * 100) });
    tone = "down";
  }
  const detail = t("benchmarks.wealthDetail", {
    user: money(w.userNetWorth),
    peer: money(w.peerMedian),
    country: countryName,
    year: w.sourceYear,
  });
  return { tone, headline, detail };
}

function describeDebt(t: T, d: DebtServiceComparison) {
  const userPct = Math.round(d.userPct);
  let tone: Tone;
  if (d.userPct <= d.medianPct) tone = "up";
  else if (d.userPct <= d.medianPct + 6) tone = "neutral";
  else tone = "down";
  const headline =
    d.userPct <= d.medianPct
      ? t("benchmarks.debtBelow", { user: userPct, median: d.medianPct })
      : t("benchmarks.debtAbove", { user: userPct, median: d.medianPct });
  const detail = t("benchmarks.debtDetail", {
    service: money(d.monthlyDebtService),
    median: d.medianPct,
    year: d.sourceYear,
  });
  return { tone, headline, detail };
}

function describeSpend(t: T, userSpend: number, expectedSpend: number, bandName: string) {
  const ratio = expectedSpend > 0 ? userSpend / expectedSpend : 1;
  const diff = userSpend - expectedSpend;
  let headline: string;
  let tone: Tone;
  if (ratio <= 0.9) {
    const pct = Math.round((1 - ratio) * 100);
    headline = t("benchmarks.spendBandLess", { pct, band: bandName });
    tone = "up";
  } else if (ratio <= 1.1) {
    headline = t("benchmarks.spendBandAbout", { band: bandName });
    tone = "neutral";
  } else {
    const pct = Math.round((ratio - 1) * 100);
    headline = t("benchmarks.spendBandMore", { pct, band: bandName });
    tone = "down";
  }
  const detail = t("benchmarks.spendBandDetail", {
    user: money(userSpend),
    expected: money(expectedSpend),
    sign: diff >= 0 ? "+" : "−",
    diff: money(Math.abs(diff)),
  });
  return { tone, headline, detail };
}
