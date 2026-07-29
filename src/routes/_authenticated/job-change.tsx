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
import { Briefcase, Loader2, Info, AlertTriangle } from "lucide-react";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { jobChangeCompare } from "@/lib/projection.functions";
import { pageShellClass } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/job-change")({
  head: () => ({ meta: [{ title: "Job change · bynku" }] }),
  component: JobChangePage,
});

const COLORS = { a: "#7a6c5d", b: "#2c6e6b" };

function thisMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function JobChangePage() {
  const t = useT();
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const runFn = useServerFn(jobChangeCompare);

  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () => fetchHh({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
  });
  const householdId = hh?.household?.id;

  const [years, setYears] = useState(10);
  const [newSalary, setNewSalary] = useState("");
  const [startMonth, setStartMonth] = useState(thisMonthStr());

  const [result, setResult] = useState<Awaited<ReturnType<typeof jobChangeCompare>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!householdId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await runFn({
        data: {
          householdId,
          horizonMonths: Math.max(12, Math.min(480, years * 12)),
          scenarios: [
            { id: "a", label: t("job.currentLabel") },
            {
              id: "b",
              label: t("job.newLabel"),
              changeMonth: startMonth,
              newMonthlySalary: Number(newSalary) || 0,
            },
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
    return a.map((p, i) => ({ year: p.ym.slice(0, 4), a: p.netWorth, b: b[i]?.netWorth ?? null }));
  }, [result]);

  const noSalary = result && result.monthlyIncome > 0 && result.salaryMonthly === 0;

  return (
    <div className={pageShellClass("4xl")}>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Briefcase className="size-3.5" />
          {t("nav.jobChange")}
        </div>
        <h1 className="font-display text-3xl md:text-4xl">{t("job.title")}</h1>
        <p className="text-muted-foreground">{t("job.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("job.inputsTitle")}</CardTitle>
          <CardDescription>{t("job.inputsHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>{t("job.newSalary")}</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={newSalary}
                onChange={(e) => setNewSalary(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">{t("job.newSalaryHint")}</p>
            </div>
            <div>
              <Label>{t("job.startMonth")}</Label>
              <Input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
            </div>
            <div>
              <Label>{t("job.years")}</Label>
              <Input
                type="number"
                min={1}
                max={40}
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
              />
            </div>
          </div>
          <Button onClick={run} disabled={busy || !householdId}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Briefcase className="size-4" />}
            {busy ? t("job.running") : t("job.run")}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <>
          {noSalary && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-600" />
              <p>{t("job.noSalary")}</p>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("job.todayTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              <Stat label={t("job.netWorthNow")} value={money(result.current.netWorth)} />
              <Stat label={t("job.currentSalary")} value={`${money(result.salaryMonthly)}/mo`} />
              <Stat label={t("job.costs")} value={`${money(result.monthlyCosts)}/mo`} />
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            {result.scenarios.map((sc, i) => {
              const spare = sc.postChangeMonthlySurplus >= 0;
              return (
                <Card key={sc.id} style={{ borderColor: i === 0 ? COLORS.a : COLORS.b }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="size-3 rounded-full" style={{ background: i === 0 ? COLORS.a : COLORS.b }} />
                      {sc.label}
                    </CardTitle>
                    {sc.newMonthlySalary != null && (
                      <CardDescription>
                        {t("job.salaryOf", { amount: money(sc.newMonthlySalary) })}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <Row
                      label={t("job.endNetWorth", { years })}
                      value={money(sc.endNetWorth.expected)}
                      sub={t("job.range", {
                        low: money(sc.endNetWorth.cautious),
                        high: money(sc.endNetWorth.optimistic),
                      })}
                    />
                    <Row
                      label={t("job.monthlyAfter")}
                      value={`${money(sc.postChangeMonthlyIncome)}/mo`}
                      sub={
                        spare
                          ? t("job.spare", { amount: money(Math.abs(sc.postChangeMonthlySurplus)) })
                          : t("job.short", { amount: money(Math.abs(sc.postChangeMonthlySurplus)) })
                      }
                      tone={spare ? "up" : "down"}
                    />
                    <Row
                      label={t("job.savings")}
                      value={
                        sc.savingsRunoutYm
                          ? t("job.runsOut", { year: sc.savingsRunoutYm.slice(0, 4) })
                          : t("job.savingsHold")
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
                const better = diff >= 0 ? result.scenarios[1] : result.scenarios[0];
                return t("job.diffNote", { label: better.label, amount: money(Math.abs(diff)) });
              })()}
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("job.chartTitle")}</CardTitle>
              <CardDescription>{t("job.chartHint")}</CardDescription>
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
                    <Tooltip formatter={(v: number) => money(Number(v))} labelFormatter={(l) => String(l)} />
                    <Legend />
                    <Line type="monotone" dataKey="a" name={result.scenarios[0]?.label} stroke={COLORS.a} dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="b" name={result.scenarios[1]?.label} stroke={COLORS.b} dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-start gap-2 text-xs text-muted-foreground border-t pt-3">
            <Info className="size-3.5 mt-0.5 shrink-0" />
            <p>{t("job.caveat")}</p>
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
