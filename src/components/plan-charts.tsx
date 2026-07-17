import { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { buildForecastSeries, type ProjectInput } from "@/lib/plan-forecast-series";
import { planAppliesToMonth, monthKey, type Plan } from "@/lib/plan";
import type { Debt } from "@/lib/debt-schedule";

const PALETTE = [
  "#6366f1",
  "#0ea5e9",
  "#14b8a6",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#22c55e",
  "#ef4444",
  "#06b6d4",
  "#a855f7",
];

type SeriesDef = { key: string; name: string; color: string; group: string; dashed?: boolean };

const shortLabel = (d: Date) =>
  d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });

export function PlanCharts({
  plans,
  projects,
  debts,
  baseline,
  monthlyIncome,
}: {
  plans: Plan[];
  projects: ProjectInput[];
  debts: Debt[];
  baseline: number;
  monthlyIncome: number;
}) {
  const t = useT();
  const [horizon, setHorizon] = useState<3 | 6 | 12>(6);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const series = useMemo(
    () => buildForecastSeries({ plans, projects, debts, baseline, monthlyIncome, months: horizon }),
    [plans, projects, debts, baseline, monthlyIncome, horizon],
  );

  // Flat rows for recharts + the list of series to draw.
  const { rows, defs } = useMemo(() => {
    const defs: SeriesDef[] = [
      { key: "income", name: t("plan.seriesIncome"), color: "#16a34a", group: t("plan.groupIncome") },
      { key: "surplus", name: t("plan.seriesSurplus"), color: "#0891b2", group: t("plan.groupIncome") },
    ];
    projects.forEach((p, i) =>
      defs.push({ key: `proj_${p.id}`, name: p.name, color: PALETTE[i % PALETTE.length], group: t("plan.groupProjects") }),
    );
    debts.forEach((d, i) =>
      defs.push({
        key: `debt_${d.id}`,
        name: (d as unknown as { label?: string }).label ?? t("plan.groupDebts"),
        color: PALETTE[(i + 5) % PALETTE.length],
        group: t("plan.groupDebts"),
        dashed: true,
      }),
    );
    defs.push({
      key: "interestSaved",
      name: t("plan.seriesInterestSaved"),
      color: "#f59e0b",
      group: t("plan.groupGains"),
    });
    defs.push({
      key: "uninvestedSurplus",
      name: t("plan.seriesUninvested"),
      color: "#a855f7",
      group: t("plan.groupGains"),
    });

    const rows = series.map((pt) => {
      const row: Record<string, number | string> = {
        label: pt.label,
        income: pt.income,
        surplus: pt.surplus,
        interestSaved: pt.interestSaved,
        uninvestedSurplus: pt.uninvestedSurplus,
      };
      for (const p of projects) row[`proj_${p.id}`] = pt.projects[p.id] ?? 0;
      for (const d of debts) row[`debt_${d.id}`] = pt.debts[d.id] ?? 0;
      return row;
    });
    return { rows, defs };
  }, [series, projects, debts, t]);

  const groups = useMemo(() => {
    const map = new Map<string, SeriesDef[]>();
    for (const d of defs) {
      if (!map.has(d.group)) map.set(d.group, []);
      map.get(d.group)!.push(d);
    }
    return Array.from(map.entries());
  }, [defs]);

  // Default view: only the project lines are shown; everything else starts
  // hidden. Runs once when the series first become available, then leaves the
  // user's own toggles alone. When there are no projects, fall back to showing
  // income and surplus so the chart isn't blank.
  const inited = useRef(false);
  useEffect(() => {
    if (inited.current || !defs.length) return;
    const projKeys = defs.filter((d) => d.key.startsWith("proj_")).map((d) => d.key);
    const shown = projKeys.length ? projKeys : ["income", "surplus"];
    setHidden(new Set(defs.filter((d) => !shown.includes(d.key)).map((d) => d.key)));
    inited.current = true;
  }, [defs]);

  function toggle(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ---- Timeline (Gantt) data ----
  const now = useMemo(() => new Date(), []);
  const timelineMonths = useMemo(
    () =>
      Array.from({ length: horizon }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        return { ym: monthKey(d), label: shortLabel(d) };
      }),
    [horizon, now],
  );
  const timelineRows = useMemo(() => {
    const startYm = timelineMonths[0]?.ym ?? monthKey(now);
    const endYm = timelineMonths[timelineMonths.length - 1]?.ym ?? startYm;
    return plans
      .filter((p) => !p.done)
      .filter((p) => timelineMonths.some((m) => planAppliesToMonth(p, m.ym)))
      .sort((a, b) => String(a.month).localeCompare(String(b.month)))
      .map((p) => {
        const dueYm = String(p.month).slice(0, 7);
        const cells = timelineMonths.map((m) => {
          const applies = planAppliesToMonth(p, m.ym);
          const saving =
            !!p.bucket_id && p.recurrence === "one_off" && m.ym >= startYm && m.ym < dueYm;
          return { applies, saving };
        });
        return { plan: p, cells };
      })
      .filter((r) => r.plan && endYm >= startYm);
  }, [plans, timelineMonths, now]);

  if (!projects.length && !debts.length && !plans.length) return null;

  const gridCols = `minmax(7rem, 1.3fr) repeat(${horizon}, minmax(2.5rem, 1fr))`;

  return (
    <div className="space-y-6">
      {/* Timeline */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>{t("plan.timelineTitle")}</CardTitle>
            <CardDescription>{t("plan.timelineDesc")}</CardDescription>
          </div>
          <HorizonToggle horizon={horizon} onChange={setHorizon} />
        </CardHeader>
        <CardContent>
          {timelineRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">{t("plan.timelineEmpty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <TooltipProvider delayDuration={80}>
                <div className="min-w-[32rem] space-y-1">
                  <div className="grid items-center gap-1 text-[10px] text-muted-foreground" style={{ gridTemplateColumns: gridCols }}>
                    <span />
                    {timelineMonths.map((m) => (
                      <span key={m.ym} className="text-center capitalize">
                        {m.label}
                      </span>
                    ))}
                  </div>
                  {timelineRows.map(({ plan, cells }) => {
                    const dueYm = String(plan.month).slice(0, 7);
                    const recKey =
                      plan.recurrence === "annual"
                        ? "plan.annual"
                        : plan.recurrence === "ongoing"
                          ? "plan.ongoing"
                          : "plan.once";
                    return (
                      <UiTooltip key={plan.id}>
                        <TooltipTrigger asChild>
                          <div
                            className="grid items-center gap-1 cursor-default rounded-sm hover:bg-muted/40"
                            style={{ gridTemplateColumns: gridCols }}
                          >
                            <span className="truncate text-xs pr-1">{plan.label}</span>
                            {cells.map((c, i) => (
                              <div key={i} className="h-5 rounded-sm bg-muted/40">
                                {c.applies ? (
                                  <div
                                    className={`h-full rounded-sm ${plan.direction === "income" ? "bg-emerald-500" : "bg-amber-500"}`}
                                  />
                                ) : c.saving ? (
                                  <div className="h-full rounded-sm bg-emerald-500/25" />
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <p className="font-medium">{plan.label}</p>
                          <p>
                            {plan.direction === "income" ? "+" : ""}
                            {money(Math.abs(Number(plan.amount) || 0))} ·{" "}
                            <span className="capitalize">
                              {shortLabel(new Date(`${dueYm}-01T00:00:00`))}
                            </span>
                          </p>
                          <p className="text-muted-foreground">
                            {t(recKey)} · {plan.bucket_id ? t("plan.funded") : t("plan.payFromLeftover")}
                          </p>
                        </TooltipContent>
                      </UiTooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Forecast chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t("plan.chartsTitle")}</CardTitle>
          <CardDescription>{t("plan.chartsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  width={48}
                  tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [money(Number(v)), name]}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                {defs.map((d) => (
                  <Line
                    key={d.key}
                    type="monotone"
                    dataKey={d.key}
                    name={d.name}
                    stroke={d.color}
                    strokeWidth={2}
                    strokeDasharray={d.dashed ? "5 4" : undefined}
                    dot={false}
                    hide={hidden.has(d.key)}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Toggleable legend, grouped */}
          <div className="mt-3 space-y-2">
            {groups.map(([group, items]) => (
              <div key={group} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[11px] font-medium text-muted-foreground w-full sm:w-auto">
                  {group}
                </span>
                {items.map((d) => {
                  const off = hidden.has(d.key);
                  return (
                    <button
                      key={d.key}
                      onClick={() => toggle(d.key)}
                      className={`flex items-center gap-1.5 text-xs ${off ? "opacity-40" : ""}`}
                    >
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{ background: d.color }}
                      />
                      {d.name}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HorizonToggle({
  horizon,
  onChange,
}: {
  horizon: 3 | 6 | 12;
  onChange: (h: 3 | 6 | 12) => void;
}) {
  return (
    <div className="flex gap-1 shrink-0">
      {([3, 6, 12] as const).map((h) => (
        <Button
          key={h}
          size="sm"
          variant={horizon === h ? "default" : "outline"}
          className="h-7 px-2 text-xs"
          onClick={() => onChange(h)}
        >
          {h}
        </Button>
      ))}
    </div>
  );
}
