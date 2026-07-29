import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Info, TrendingUp, TrendingDown, Minus, Building2 } from "lucide-react";
import { money } from "@/lib/format";
import { debtLiveSchedule, debtMonthlyRate, type Debt } from "@/lib/debt-schedule";
import { computeBusinessBenchmark, hasSectorBenchmark } from "@/lib/business-benchmarks";
import { useT } from "@/lib/i18n";

/**
 * "How you compare" for business spaces: revenue-per-employee (productivity) and
 * operating margin (efficiency) against the company's Eurostat SBS sector, plus
 * the sector's headline figures for context. Renders nothing for households.
 */
export function BusinessBenchmarksCard({ householdId }: { householdId: string }) {
  const t = useT();

  const { data: hh, isLoading } = useQuery({
    enabled: !!householdId,
    queryKey: ["biz-benchmark-hh", householdId],
    queryFn: async () => {
      const { data } = await supabase
        .from("households")
        .select("country, kind, employees, sector")
        .eq("id", householdId)
        .maybeSingle();
      return data as {
        country: string | null;
        kind: string | null;
        employees: number | null;
        sector: string | null;
      } | null;
    },
  });

  const { data: fin } = useQuery({
    enabled: !!householdId && hh?.kind === "business",
    queryKey: ["biz-benchmark-fin", householdId],
    queryFn: async () => {
      const [{ data: inc }, { data: fx }, { data: ve }, { data: debts }] = await Promise.all([
        supabase.from("incomes").select("monthly_amount").eq("household_id", householdId),
        supabase.from("fixed_expenses").select("monthly_amount").eq("household_id", householdId),
        supabase.from("variable_estimates").select("monthly_amount").eq("household_id", householdId),
        supabase.from("debts").select("*").eq("household_id", householdId),
      ]);
      const sum = (rows: { monthly_amount: number | string }[] | null) =>
        (rows ?? []).reduce((s, r) => s + Number(r.monthly_amount || 0), 0);
      const revenue = sum(inc);
      const fixed = sum(fx);
      const variable = sum(ve);
      // Operating costs exclude capex (assets) and loan PRINCIPAL — only the debt
      // interest is an operating cost — so the margin matches the sector gross
      // operating rate we compare against.
      const debtInterest = ((debts ?? []) as Debt[]).reduce(
        (s, d) => s + debtLiveSchedule(d).remaining * debtMonthlyRate(d),
        0,
      );
      const operatingCosts = fixed + variable + debtInterest;
      const operatingMarginPct = revenue > 0 ? ((revenue - operatingCosts) / revenue) * 100 : null;
      return { revenue, operatingMarginPct };
    },
  });

  const isBusiness = hh?.kind === "business";
  const sector = hh?.sector ?? null;

  const bench = useMemo(() => {
    if (!isBusiness || !fin) return null;
    return computeBusinessBenchmark({
      sector,
      country: hh?.country ?? null,
      revenueMonthly: fin.revenue,
      employees: Number(hh?.employees ?? 0),
      operatingMarginPct: fin.operatingMarginPct,
    });
  }, [isBusiness, fin, sector, hh?.country, hh?.employees]);

  if (isLoading || !isBusiness) return null;

  // Sector not chosen, or a sector we don't have SBS data for.
  if (!sector || !hasSectorBenchmark(sector)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4" /> {t("bizcmp.titlePlain")}
          </CardTitle>
          <CardDescription>
            {!sector ? t("bizcmp.setSector") : t("bizcmp.notAvailable")}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!bench) return null;
  const { sector: sec, productivity, efficiency } = bench;

  const prodTone = productivity
    ? productivity.ratio >= 1.1
      ? "up"
      : productivity.ratio >= 0.9
        ? "neutral"
        : "down"
    : "neutral";
  const effDiff = efficiency ? efficiency.userMarginPct - efficiency.sectorRatePct : 0;
  const effTone = efficiency ? (effDiff >= 2 ? "up" : effDiff >= -2 ? "neutral" : "down") : "neutral";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-4" /> {t("bizcmp.title", { sector: bench.sectorName })}
        </CardTitle>
        <CardDescription>
          {t("bizcmp.desc", { section: bench.sectionName, year: bench.sourceYear })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sector reference figures */}
        <div>
          <h4 className="text-sm font-medium mb-2">{t("bizcmp.sectorSnapshot")}</h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {sec.labourProductivityK != null && (
              <StatTile
                label={t("bizcmp.labourProductivity")}
                value={`${money(sec.labourProductivityK * 1000)}`}
                sub={t("bizcmp.perEmployee")}
              />
            )}
            {sec.turnoverPerPersonK != null && (
              <StatTile
                label={t("bizcmp.turnoverPerPerson")}
                value={`${money(sec.turnoverPerPersonK * 1000)}`}
                sub={t("bizcmp.perEmployee")}
              />
            )}
            {sec.grossOperatingRatePct != null && (
              <StatTile
                label={t("bizcmp.grossOperatingRate")}
                value={`${sec.grossOperatingRatePct.toFixed(1)}%`}
                sub={t("bizcmp.ofRevenue")}
              />
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("bizcmp.euNote", { year: bench.sourceYear })}
          </p>
        </div>

        {fin && fin.revenue <= 0 ? (
          <p className="text-sm text-muted-foreground">{t("bizcmp.needInputs")}</p>
        ) : (
          <>
            {productivity && (
              <StoryTile
                tone={prodTone}
                headline={
                  prodTone === "up"
                    ? t("bizcmp.productivityAbove", {
                        pct: Math.round((productivity.ratio - 1) * 100),
                      })
                    : prodTone === "down"
                      ? t("bizcmp.productivityBelow", {
                          pct: Math.round((1 - productivity.ratio) * 100),
                        })
                      : t("bizcmp.productivityAbout")
                }
                detail={t("bizcmp.productivityDetail", {
                  user: money(productivity.userPerEmployeeK * 1000),
                  sector: money(productivity.sectorPerPersonK * 1000),
                })}
              />
            )}
            {productivity && bench.countryProductivityK != null && hh?.country && (
              <p className="-mt-2 text-xs text-muted-foreground">
                {t("bizcmp.countryContext", {
                  country: hh.country,
                  value: money(bench.countryProductivityK * 1000),
                })}
              </p>
            )}

            {efficiency && (
              <StoryTile
                tone={effTone}
                headline={
                  effTone === "up"
                    ? t("bizcmp.efficiencyAbove", { pp: effDiff.toFixed(1) })
                    : effTone === "down"
                      ? t("bizcmp.efficiencyBelow", { pp: Math.abs(effDiff).toFixed(1) })
                      : t("bizcmp.efficiencyAbout")
                }
                detail={t("bizcmp.efficiencyDetail", {
                  user: `${efficiency.userMarginPct.toFixed(1)}%`,
                  sector: `${efficiency.sectorRatePct.toFixed(1)}%`,
                })}
              />
            )}
            {efficiency && (
              <p className="-mt-2 text-xs text-muted-foreground">{t("bizcmp.marginNote")}</p>
            )}
          </>
        )}

        <div className="flex items-start gap-2 border-t pt-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <p>{t("bizcmp.methodology", { year: bench.sourceYear })}</p>
        </div>
      </CardContent>
    </Card>
  );
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
    tone === "up" ? "text-emerald-600" : tone === "down" ? "text-amber-600" : "text-muted-foreground";
  return (
    <div className={`flex gap-3 rounded-lg border p-3 ${cls}`}>
      <Icon className={`mt-0.5 size-4 shrink-0 ${iconCls}`} />
      <div className="min-w-0">
        <div className="text-sm font-medium">{headline}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}
