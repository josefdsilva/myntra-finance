import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Umbrella, Loader2, Info, AlertTriangle } from "lucide-react";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { retirementCompare } from "@/lib/projection.functions";
import { pageShellClass } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/retirement")({
  head: () => ({ meta: [{ title: "Retirement · bynku" }] }),
  component: RetirementPage,
});

const COLORS = { a: "#2c6e6b", b: "#bc6c25" };

function RetirementPage() {
  const t = useT();
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const runFn = useServerFn(retirementCompare);

  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () => fetchHh({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
  });
  const householdId = hh?.household?.id;
  const thisYear = new Date().getFullYear();

  const [bornYear, setBornYear] = useState(thisYear - 60);
  const [ageA, setAgeA] = useState(63);
  const [ageB, setAgeB] = useState(65);
  const [pensionA, setPensionA] = useState("");
  const [pensionB, setPensionB] = useState("");

  const [result, setResult] = useState<Awaited<ReturnType<typeof retirementCompare>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Retirement at age X = January of (bornYear + X). We only store an age band,
  // not a birth month, so January is a reasonable, consistent choice.
  const retireMonth = (age: number) => `${bornYear + age}-01`;
  const currentAge = thisYear - bornYear;

  async function run() {
    if (!householdId) return;
    setBusy(true);
    setError(null);
    try {
      // Project to age 90 (clamped by the server to 40 years).
      const horizonMonths = Math.max(12, Math.min(480, (90 - currentAge) * 12));
      const res = await runFn({
        data: {
          householdId,
          horizonMonths,
          scenarios: [
            { id: "a", retireMonth: retireMonth(ageA), monthlyPension: Number(pensionA) || 0, label: t("ret.atAge", { age: ageA }) },
            { id: "b", retireMonth: retireMonth(ageB), monthlyPension: Number(pensionB) || 0, label: t("ret.atAge", { age: ageB }) },
          ],
        },
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const chartData = useMemo(() => {
    if (!result) return [];
    const a = result.scenarios[0]?.series ?? [];
    const b = result.scenarios[1]?.series ?? [];
    return a.map((p, i) => ({
      year: p.ym.slice(0, 4),
      a: p.netWorth,
      b: b[i]?.netWorth ?? null,
    }));
  }, [result]);

  const noSalary = result && result.monthlyIncome > 0 && result.salaryMonthly === 0;

  return (
    <div className={pageShellClass("4xl")}>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Umbrella className="size-3.5" />
          {t("nav.retirement")}
        </div>
        <h1 className="font-display text-3xl md:text-4xl">{t("ret.title")}</h1>
        <p className="text-muted-foreground">{t("ret.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("ret.inputsTitle")}</CardTitle>
          <CardDescription>{t("ret.inputsHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-[220px]">
            <Label>{t("ret.bornYear")}</Label>
            <Input
              type="number"
              min={thisYear - 90}
              max={thisYear - 40}
              value={bornYear}
              onChange={(e) => setBornYear(Number(e.target.value))}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("ret.currentAge", { age: currentAge })}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { key: "a", age: ageA, setAge: setAgeA, pension: pensionA, setPension: setPensionA, color: COLORS.a },
              { key: "b", age: ageB, setAge: setAgeB, pension: pensionB, setPension: setPensionB, color: COLORS.b },
            ].map((s) => (
              <div key={s.key} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="size-3 rounded-full" style={{ background: s.color }} />
                  {t(s.key === "a" ? "ret.optionA" : "ret.optionB")}
                </div>
                <div>
                  <Label>{t("ret.retireAge")}</Label>
                  <Input
                    type="number"
                    min={currentAge}
                    max={80}
                    value={s.age}
                    onChange={(e) => s.setAge(Number(e.target.value))}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("ret.retiresIn", { year: bornYear + s.age })}
                  </p>
                </div>
                <div>
                  <Label>{t("ret.pension")}</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={s.pension}
                    onChange={(e) => s.setPension(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{t("ret.pensionHint")}</p>
                </div>
              </div>
            ))}
          </div>

          <Button onClick={run} disabled={busy || !householdId}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Umbrella className="size-4" />}
            {busy ? t("ret.running") : t("ret.run")}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <>
          {noSalary && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-600" />
              <p>{t("ret.noSalary")}</p>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("ret.todayTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label={t("ret.netWorthNow")} value={money(result.current.netWorth)} />
              <Stat label={t("ret.income")} value={`${money(result.monthlyIncome)}/mo`} />
              <Stat label={t("ret.salaryPart")} value={`${money(result.salaryMonthly)}/mo`} />
              <Stat label={t("ret.costs")} value={`${money(result.monthlyCosts)}/mo`} />
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            {result.scenarios.map((sc, i) => {
              const covers = sc.postRetireMonthlySurplus >= 0;
              return (
                <Card key={sc.id} style={{ borderColor: i === 0 ? COLORS.a : COLORS.b }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span
                        className="size-3 rounded-full"
                        style={{ background: i === 0 ? COLORS.a : COLORS.b }}
                      />
                      {sc.label}
                    </CardTitle>
                    <CardDescription>
                      {t("ret.pensionOf", { amount: money(sc.monthlyPension) })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <Row
                      label={t("ret.endNetWorth")}
                      value={money(sc.endNetWorth.expected)}
                      sub={t("ret.range", {
                        low: money(sc.endNetWorth.cautious),
                        high: money(sc.endNetWorth.optimistic),
                      })}
                    />
                    <Row
                      label={t("ret.afterRetiring")}
                      value={`${money(sc.postRetireMonthlyIncome)}/mo`}
                      sub={
                        covers
                          ? t("ret.coversCosts", { amount: money(Math.abs(sc.postRetireMonthlySurplus)) })
                          : t("ret.shortfall", { amount: money(Math.abs(sc.postRetireMonthlySurplus)) })
                      }
                      tone={covers ? "up" : "down"}
                    />
                    <Row
                      label={t("ret.savings")}
                      value={
                        sc.savingsRunoutYm
                          ? t("ret.runsOut", { year: sc.savingsRunoutYm.slice(0, 4) })
                          : t("ret.savingsHold")
                      }
                      tone={sc.savingsRunoutYm ? "down" : "up"}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {result.scenarios.length === 2 && (
            <p className="text-sm text-muted-foreground">
              {(() => {
                const diff = result.scenarios[1].endNetWorth.expected - result.scenarios[0].endNetWorth.expected;
                const later = diff >= 0 ? result.scenarios[1] : result.scenarios[0];
                return t("ret.diffNote", { label: later.label, amount: money(Math.abs(diff)) });
              })()}
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("ret.chartTitle")}</CardTitle>
              <CardDescription>{t("ret.chartHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} minTickGap={24} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => money(Number(v)).replace(/[.,]00$/, "")}
                      width={70}
                    />
                    <Tooltip
                      formatter={(v: number) => money(Number(v))}
                      labelFormatter={(l) => String(l)}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="a"
                      name={result.scenarios[0]?.label}
                      stroke={COLORS.a}
                      dot={false}
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="b"
                      name={result.scenarios[1]?.label}
                      stroke={COLORS.b}
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-start gap-2 text-xs text-muted-foreground border-t pt-3">
            <Info className="size-3.5 mt-0.5 shrink-0" />
            <p>{t("ret.caveat")}</p>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Row({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down";
}) {
  const toneCls = tone === "up" ? "text-emerald-600" : tone === "down" ? "text-amber-600" : "";
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">
        <span className="font-medium tabular-nums">{value}</span>
        {sub && <span className={`block text-xs ${toneCls}`}>{sub}</span>}
      </span>
    </div>
  );
}
