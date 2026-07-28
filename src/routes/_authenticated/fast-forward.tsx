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
import { FastForward, Loader2, Info, TrendingUp, Target } from "lucide-react";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { fastForward } from "@/lib/projection.functions";
import type { ProjectionMonth } from "@/lib/projection";
import { pageShellClass } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { money } from "@/lib/format";
import { useLocale, useT, type MessageKey } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/fast-forward")({
  head: () => ({ meta: [{ title: "Fast forward · bynku" }] }),
  component: FastForwardPage,
});

const MAX_MONTHS = 36;

function ymStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function FastForwardPage() {
  const t = useT();
  const locale = useLocale();
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const runFn = useServerFn(fastForward);

  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () => fetchHh({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
  });
  const householdId = hh?.household?.id;

  const now = new Date();
  const minMonth = ymStr(addMonths(now, 1));
  const maxMonth = ymStr(addMonths(now, MAX_MONTHS));
  const [target, setTarget] = useState(() => ymStr(addMonths(now, 12)));

  const { data, isLoading } = useQuery({
    enabled: !!householdId,
    queryKey: ["fast-forward", householdId, target],
    queryFn: () => runFn({ data: { householdId: householdId!, targetMonth: target } }),
  });

  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, (m || 1) - 1, 1).toLocaleDateString(locale, {
      month: "short",
      year: "numeric",
    });
  };

  const isBusiness = data?.isBusiness ?? false;
  const worthKey = isBusiness ? "ff.cash" : "ff.netWorth";

  const byKey = useMemo(() => {
    const m: Record<string, { key: string; series: ProjectionMonth[]; at: ProjectionMonth }> = {};
    for (const s of data?.scenarios ?? []) m[s.key] = s;
    return m;
  }, [data]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const exp = byKey.expected?.series ?? [];
    const cau = byKey.cautious?.series ?? [];
    const opt = byKey.optimistic?.series ?? [];
    const head = {
      ym: data.startYm,
      label: monthLabel(data.startYm),
      expected: data.current.netWorth,
      cautious: data.current.netWorth,
      optimistic: data.current.netWorth,
    };
    const rest = exp.map((row, i) => ({
      ym: row.ym,
      label: monthLabel(row.ym),
      expected: row.netWorth,
      cautious: cau[i]?.netWorth ?? null,
      optimistic: opt[i]?.netWorth ?? null,
    }));
    return [head, ...rest];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, byKey, locale]);

  return (
    <div className={pageShellClass("4xl")}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl">
            <FastForward className="size-6 text-primary" /> {t("ff.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(isBusiness ? "ff.subtitleBiz" : "ff.subtitle")}
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <Label className="text-xs">{t("ff.targetLabel")}</Label>
          <Input
            type="month"
            value={target}
            min={minMonth}
            max={maxMonth}
            onChange={(e) => e.target.value && setTarget(e.target.value)}
            className="w-full sm:w-48"
          />
        </div>
      </div>

      {!householdId || isLoading || !data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Headline: position at target */}
          <Card className="border-primary/25 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-5 text-primary" />
                {t("ff.positionIn", { date: monthLabel(data.targetYm) })}
              </CardTitle>
              <CardDescription>{t("ff.headlineDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(["cautious", "expected", "optimistic"] as const).map((k) => {
                  const at = byKey[k]?.at;
                  const primary = k === "expected";
                  return (
                    <div
                      key={k}
                      className={`rounded-lg border p-3 ${primary ? "border-primary/40 bg-background" : ""}`}
                    >
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {t(`ff.scenario.${k}`)}
                      </p>
                      <p
                        className={`font-display tabular-nums ${primary ? "text-2xl" : "text-xl text-muted-foreground"}`}
                      >
                        {money(at?.netWorth ?? 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">{t(worthKey)}</p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" /> {t("ff.rangeNote")}
              </p>
            </CardContent>
          </Card>

          {/* Now vs then breakdown */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label={t("ff.now")} value={money(data.current.netWorth)} sub={t(worthKey)} />
            <Stat
              label={t("ff.savingsThen")}
              value={money(byKey.expected?.at.savings ?? 0)}
              sub={t("ff.savings")}
            />
            <Stat
              label={t("ff.debtThen")}
              value={money(byKey.expected?.at.debtRemaining ?? 0)}
              sub={
                byKey.expected?.at.debtFree
                  ? t("ff.debtFree")
                  : t("ff.fromNow", { value: money(data.current.debtRemaining) })
              }
              good={byKey.expected?.at.debtFree}
            />
            <Stat
              label={t("ff.surplusThen")}
              value={money(byKey.expected?.at.surplus ?? 0)}
              sub={t("ff.surplusMonthly")}
            />
          </div>

          {/* Trajectory chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("ff.chartTitle", { worth: t(worthKey) })}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      width={70}
                      tickFormatter={(v) => money(Number(v))}
                    />
                    <Tooltip
                      formatter={(v: number, name) => [
                        money(Number(v)),
                        t(`ff.scenario.${name}` as MessageKey),
                      ]}
                      labelStyle={{ color: "var(--foreground)" }}
                      contentStyle={{
                        background: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend
                      formatter={(name) => t(`ff.scenario.${name}` as MessageKey)}
                      wrapperStyle={{ fontSize: 12 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="optimistic"
                      stroke="#16a34a"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="expected"
                      stroke="var(--primary)"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="cautious"
                      stroke="#d97706"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Per-project funding */}
          {data.projects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="size-4 text-primary" /> {t("ff.projectsTitle")}
                </CardTitle>
                <CardDescription>
                  {t("ff.projectsDesc", { date: monthLabel(data.targetYm) })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {data.projects.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">{p.name}</span>
                        {p.reachedGoal && (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600">
                            {t("ff.reached")}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {money(p.startBalance)} <span className="text-foreground">→</span>{" "}
                        <span className="font-medium text-foreground">
                          {money(p.projectedBalance)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" /> {t("ff.disclaimer")}
          </p>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  good,
}: {
  label: string;
  value: string;
  sub?: string;
  good?: boolean;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-display text-lg tabular-nums ${good ? "text-emerald-600" : ""}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
