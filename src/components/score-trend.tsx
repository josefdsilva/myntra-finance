import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Sparkles, LineChart as LineChartIcon } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT, type MessageKey } from "@/lib/i18n";
import { money } from "@/lib/format";
import { deltaVsPrev, vsAverage, streak, meanSignedErrorPct } from "@/lib/cycle-metrics";

type MetricRow = {
  cycle_start: string;
  cycle_end: string;
  score_overall: number | null;
  source: string;
  everyday_pool: number | null;
  everyday_spent: number | null;
  income_expected: number | null;
  income_actual: number;
  spend_actual: number;
  fixed_total: number;
  project_funded: number;
  surplus_actual: number;
  superfluous_share: number | null;
};

/** Cycle-metrics history for a space, oldest first. Shared by all variants. */
export function useCycleMetrics(householdId?: string) {
  return useQuery({
    enabled: !!householdId,
    queryKey: ["cycle-metrics", householdId],
    queryFn: async (): Promise<MetricRow[]> => {
      const { data } = await supabase
        .from("cycle_metrics")
        .select(
          "cycle_start, cycle_end, score_overall, source, everyday_pool, everyday_spent, income_expected, income_actual, spend_actual, fixed_total, project_funded, surplus_actual, superfluous_share",
        )
        .eq("household_id", householdId!)
        .order("cycle_start", { ascending: true });
      return (data ?? []) as MetricRow[];
    },
  });
}

/** "Aug" style label from a YYYY-MM-DD cycle_start. */
function cycleLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, { month: "short" });
}

/** Minimal inline-SVG sparkline (kept dependency-free for the Snapshot card). */
function Spark({ values }: { values: number[] }) {
  const w = 132;
  const h = 36;
  const pad = 3;
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const x = (i: number) => pad + (i / (values.length - 1)) * (w - 2 * pad);
  const y = (v: number) => h - pad - ((v - min) / range) * (h - 2 * pad);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const lastX = x(values.length - 1);
  const lastY = y(values[values.length - 1]);
  return (
    <svg width={w} height={h} className="text-primary" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={3} fill="currentColor" />
    </svg>
  );
}

function DeltaChip({ delta }: { delta: number }) {
  const t = useT();
  const up = delta > 0;
  const flat = delta === 0;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const tone = flat
    ? "text-muted-foreground"
    : up
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-orange-600 dark:text-orange-400";
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium tabular-nums ${tone}`}>
      <Icon className="size-4" />
      {t("trend.vsLast", { value: `${up ? "+" : ""}${delta}` })}
    </span>
  );
}

/**
 * Compact score trend for the Snapshot page: latest score, delta vs last cycle,
 * and a sparkline. Renders nothing until there are at least two scored cycles.
 */
export function ScoreTrendMini({
  householdId,
  isBusiness = false,
}: {
  householdId?: string;
  isBusiness?: boolean;
}) {
  const t = useT();
  const { data } = useCycleMetrics(householdId);
  const scored = useMemo(
    () => (data ?? []).filter((r) => typeof r.score_overall === "number"),
    [data],
  );
  if (scored.length < 2) return null;
  const values = scored.map((r) => Number(r.score_overall));
  const delta = deltaVsPrev(scored, "score_overall") ?? 0;
  const latest = values[values.length - 1];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <LineChartIcon className="size-4 text-primary" />
          {t(isBusiness ? "trend.scoreTitleBiz" : "trend.scoreTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-display tabular-nums leading-none">{latest}</span>
          <DeltaChip delta={delta} />
        </div>
        <Spark values={values} />
      </CardContent>
    </Card>
  );
}

/**
 * A single encouraging line for the Dashboard when the household is on a genuine
 * streak (saving, cutting superfluous spend, or a rising score) or hits a
 * cycles-tracked milestone. Significance-gated (≥3 for streaks) so it never nags;
 * renders nothing when there's nothing worth celebrating.
 */
export function MomentumCard({ householdId }: { householdId?: string }) {
  const t = useT();
  const { data } = useCycleMetrics(householdId);
  const rows = data ?? [];
  if (rows.length < 2) return null;

  const scored = rows.filter((r) => typeof r.score_overall === "number");
  const withShare = rows.filter((r) => typeof r.superfluous_share === "number");
  const savingStreak = streak(rows, (c) => Number(c.surplus_actual) > 0);
  const scoreUpStreak = streak(
    scored,
    (c, p) => p !== undefined && Number(c.score_overall) > Number(p.score_overall),
  );
  const superfluousDown = streak(
    withShare,
    (c, p) => p !== undefined && Number(c.superfluous_share) < Number(p.superfluous_share),
  );
  const cycles = rows.length;

  let msg: string | null = null;
  if (superfluousDown >= 3) msg = t("momentum.superfluous", { n: superfluousDown });
  else if (savingStreak >= 3) msg = t("momentum.saving", { n: savingStreak });
  else if (scoreUpStreak >= 3) msg = t("momentum.score", { n: scoreUpStreak });
  else if ([3, 6, 12, 24].includes(cycles)) msg = t("momentum.milestone", { n: cycles });
  if (!msg) return null;

  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5">
      <CardContent className="flex items-center gap-3 pt-6">
        <Sparkles className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p className="text-sm font-medium">{msg}</p>
      </CardContent>
    </Card>
  );
}

function DriftRow({ label, pct }: { label: string; pct: number | null }) {
  const t = useT();
  if (pct == null) return null;
  const over = pct > 2;
  const under = pct < -2;
  const tone = over
    ? "text-orange-600 dark:text-orange-400"
    : under
      ? "text-sky-600 dark:text-sky-400"
      : "text-emerald-600 dark:text-emerald-400";
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${tone}`}>
        {pct > 0 ? "+" : ""}
        {pct}% {t("calib.vsEstimate")}
      </span>
    </div>
  );
}

/**
 * Estimate-vs-actual calibration: how the household's everyday and income
 * estimates have compared with reality over recent cycles. Positive everyday
 * drift means they consistently spend above their estimate. Renders nothing
 * until there are at least two cycles with usable estimates.
 */
export function CalibrationCard({
  householdId,
  isBusiness = false,
}: {
  householdId?: string;
  isBusiness?: boolean;
}) {
  const t = useT();
  const { data } = useCycleMetrics(householdId);
  const rows = data ?? [];
  const everyday = meanSignedErrorPct(rows, "everyday_pool", "everyday_spent");
  const income = meanSignedErrorPct(rows, "income_expected", "income_actual");
  const n = Math.max(everyday?.n ?? 0, income?.n ?? 0);
  if (n < 2 || (everyday == null && income == null)) return null;
  const overspends = (everyday?.pct ?? 0) > 10 && (everyday?.n ?? 0) >= 3;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <LineChartIcon className="size-4 text-primary" />
          {t("calib.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DriftRow label={t(isBusiness ? "calib.costs" : "calib.everyday")} pct={everyday?.pct ?? null} />
        <DriftRow label={t(isBusiness ? "calib.revenue" : "calib.income")} pct={income?.pct ?? null} />
        <p className="mt-2 text-xs text-muted-foreground">
          {overspends ? t("calib.hintOver") : t("calib.subtitle", { n })}
        </p>
      </CardContent>
    </Card>
  );
}

const RANGES = [
  { key: "3", n: 3 },
  { key: "6", n: 6 },
  { key: "12", n: 12 },
  { key: "all", n: Infinity },
] as const;

/**
 * Full score-over-time card for the Analysis page: a line chart across cycles
 * with a range control. Works for households and companies (same score column).
 */
export function ScoreTrendCard({
  householdId,
  isBusiness = false,
}: {
  householdId?: string;
  isBusiness?: boolean;
}) {
  const t = useT();
  const { data } = useCycleMetrics(householdId);
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("6");

  const scored = useMemo(
    () => (data ?? []).filter((r) => typeof r.score_overall === "number"),
    [data],
  );
  const n = RANGES.find((r) => r.key === range)?.n ?? 6;
  const rows = useMemo(() => (n === Infinity ? scored : scored.slice(-n)), [scored, n]);
  const hasEstimated = rows.some((r) => r.source === "backfill");

  if (scored.length < 2) return null;

  const chartData = rows.map((r) => ({
    label: cycleLabel(r.cycle_start),
    score: Number(r.score_overall),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-base">
            <LineChartIcon className="size-4 text-primary" />
            {t(isBusiness ? "trend.scoreTitleBiz" : "trend.scoreTitle")}
          </CardTitle>
          <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                aria-pressed={range === r.key}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  range === r.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`trend.range.${r.key}` as MessageKey)}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={32} fontSize={12} />
              <Tooltip
                formatter={(v: number | string) => [v, t(isBusiness ? "trend.scoreTitleBiz" : "trend.scoreTitle")]}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "var(--popover-foreground)" }}
                itemStyle={{ color: "var(--popover-foreground)" }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--primary)", stroke: "var(--primary)" }}
                activeDot={{ r: 5, fill: "var(--primary)", stroke: "var(--background)", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {hasEstimated && (
          <p className="mt-2 text-xs text-muted-foreground">{t("trend.estimatedNote")}</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Cycle-vs-cycle comparison: this cycle's income, spend, saved and surplus, with
 * the change since last cycle and versus the trailing 3-cycle average. On the
 * Analysis page (private), so real amounts are fine here.
 */
export function CycleCompareCard({
  householdId,
  isBusiness = false,
}: {
  householdId?: string;
  isBusiness?: boolean;
}) {
  const t = useT();
  const { data } = useCycleMetrics(householdId);
  const rows = data ?? [];
  if (rows.length < 2) return null;

  const metrics: Array<{ key: keyof MetricRow; label: string; goodUp: boolean }> = [
    { key: "income_actual", label: t(isBusiness ? "compare.revenue" : "compare.income"), goodUp: true },
    { key: "spend_actual", label: t(isBusiness ? "compare.costs" : "compare.spend"), goodUp: false },
    { key: "project_funded", label: t("compare.saved"), goodUp: true },
    { key: "surplus_actual", label: t("compare.surplus"), goodUp: true },
  ];
  const last = rows[rows.length - 1];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <LineChartIcon className="size-4 text-primary" /> {t("compare.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-1 flex items-center justify-end gap-4 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>{t("compare.thisCycle")}</span>
          <span className="w-12 text-right">{t("compare.vsAvg")}</span>
        </div>
        {metrics.map((m) => {
          const latest = Number(last[m.key]);
          const delta = deltaVsPrev(rows, m.key) ?? 0;
          const avg = vsAverage(rows, m.key, 3);
          const goodDelta = m.goodUp ? delta >= 0 : delta <= 0;
          return (
            <div
              key={String(m.key)}
              className="flex items-center justify-between gap-3 border-b py-1.5 last:border-0"
            >
              <span className="text-sm text-muted-foreground">{m.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">{money(latest)}</span>
                {Math.abs(delta) >= 0.01 && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs tabular-nums ${goodDelta ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"}`}
                  >
                    {delta > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                    {delta > 0 ? "+" : ""}
                    {money(delta)}
                  </span>
                )}
                <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                  {avg ? `${avg.deltaPct > 0 ? "+" : ""}${avg.deltaPct}%` : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/**
 * Superfluous-spending trend: the share of spend going to nice-to-haves and
 * treats over time, with a badge when it's been falling for a few cycles.
 */
export function SuperfluousTrendCard({ householdId }: { householdId?: string }) {
  const t = useT();
  const { data } = useCycleMetrics(householdId);
  const rows = useMemo(
    () => (data ?? []).filter((r) => typeof r.superfluous_share === "number"),
    [data],
  );
  if (rows.length < 2) return null;

  const chartData = rows.map((r) => ({
    label: cycleLabel(r.cycle_start),
    pct: Math.round(Number(r.superfluous_share) * 100),
  }));
  const improving = streak(
    rows,
    (c, p) => p === undefined || Number(c.superfluous_share) < Number(p.superfluous_share),
  );
  const latestPct = chartData[chartData.length - 1].pct;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-base">
            <LineChartIcon className="size-4 text-primary" /> {t("superfluous.title")}
          </CardTitle>
          {improving >= 2 && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {t("superfluous.improving", { n: improving })}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} width={34} fontSize={12} unit="%" />
              <Tooltip
                formatter={(v: number | string) => [`${v}%`, t("superfluous.title")]}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "var(--popover-foreground)" }}
                itemStyle={{ color: "var(--popover-foreground)" }}
              />
              <Line
                type="monotone"
                dataKey="pct"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--primary)", stroke: "var(--primary)" }}
                activeDot={{ r: 5, fill: "var(--primary)", stroke: "var(--background)", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("superfluous.subtitle", { pct: latestPct })}</p>
      </CardContent>
    </Card>
  );
}
