import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { money, fmtDate } from "@/lib/format";
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  Legend,
  Area,
} from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { format as fmt } from "date-fns";
import { computeCycle } from "@/lib/cycle";
import { CoachPanel } from "@/components/coach-panel";
import { BenchmarksCard } from "@/components/benchmarks-card";
import { pageShellClass } from "@/components/page-shell";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/analysis")({
  head: () => ({ meta: [{ title: "Analysis · bynku" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    ask: typeof search.ask === "string" ? search.ask : undefined,
  }),
  component: AnalysisPage,
});

type Expense = {
  id: string;
  amount: number | string;
  category: string;
  occurred_at: string;
  kind: "expense" | "income";
};

const COLORS = [
  "#2c6e6b",
  "#c89b6c",
  "#a05c4a",
  "#3d7d8a",
  "#8a6b3d",
  "#6b8a3d",
  "#5a4a8a",
  "#8a3d6b",
  "#3d5a8a",
  "#8a8a3d",
  "#5c7a99",
  "#99785c",
  "#7a5c99",
  "#99995c",
];

type RangeKey = "1" | "2" | "3" | "6" | "12" | "all";

type BurnPayloadItem = {
  payload?: {
    label: string;
    balance: number;
    events?: Array<{ kind: string; label: string; amount: number; delta: number }>;
  };
};
function BurnTooltip({ active, payload }: { active?: boolean; payload?: BurnPayloadItem[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div
      style={{
        background: "var(--popover)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 8,
        fontSize: 12,
        maxWidth: 260,
      }}
    >
      <div style={{ fontWeight: 600 }}>{p.label}</div>
      <div style={{ marginTop: 2 }}>Balance: {money(p.balance)}</div>
      {p.events && p.events.length > 0 && p.events.some((e) => e.delta !== 0) && (
        <div style={{ marginTop: 6, borderTop: "1px solid var(--border)", paddingTop: 6 }}>
          {p.events
            .filter((e) => e.delta !== 0)
            .map((e, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ opacity: 0.85 }}>
                  {e.kind === "income" ? "↑" : e.kind === "fixed" ? "▼" : "↓"} {e.label}
                </span>
                <span
                  style={{ color: e.delta >= 0 ? "var(--primary)" : "hsl(var(--destructive))" }}
                >
                  {e.delta >= 0 ? "+" : ""}
                  {money(e.delta)}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function AnalysisPage() {
  const t = useT();
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () => fetchHh({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
  });
  const householdId = hh?.household?.id;
  const baseline = Number(hh?.household?.baseline_budget ?? 0);
  const { ask: initialAsk } = Route.useSearch();

  const [range, setRange] = useState<RangeKey>("1");
  const [includeFixed, setIncludeFixed] = useState(true);

  // All salary dates (asc) → cycles
  const { data: salaryAsc = [] } = useQuery({
    enabled: !!householdId,
    queryKey: ["salary-dates-asc", householdId],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("occurred_at")
        .eq("household_id", householdId!)
        .eq("is_salary", true)
        .order("occurred_at", { ascending: true });
      return (data ?? []).map((r) => r.occurred_at as string);
    },
  });

  const cycles = useMemo(() => {
    // Build cycles from consecutive salaries; last cycle end predicted from prior interval
    const out: { start: Date; end: Date; predicted: boolean }[] = [];
    if (!salaryAsc.length) return out;
    for (let i = 0; i < salaryAsc.length; i++) {
      const start = new Date(salaryAsc[i]);
      let end: Date;
      let predicted = false;
      if (i < salaryAsc.length - 1) {
        end = new Date(salaryAsc[i + 1]);
      } else {
        predicted = true;
        if (i >= 1) {
          const prev = new Date(salaryAsc[i - 1]);
          const diff = start.getTime() - prev.getTime();
          const days = Math.round(diff / 86400000);
          end =
            days >= 20 && days <= 45
              ? new Date(start.getTime() + diff)
              : new Date(
                  start.getFullYear(),
                  start.getMonth() + 1,
                  start.getDate(),
                  start.getHours(),
                  start.getMinutes(),
                );
        } else {
          end = new Date(
            start.getFullYear(),
            start.getMonth() + 1,
            start.getDate(),
            start.getHours(),
            start.getMinutes(),
          );
        }
      }
      out.push({ start, end, predicted });
    }
    return out;
  }, [salaryAsc]);

  const { start, end, cycleCount } = useMemo(() => {
    if (!cycles.length) {
      const now = new Date();
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now, cycleCount: 0 };
    }
    const n = range === "all" ? cycles.length : Math.min(cycles.length, Number(range));
    const selected = cycles.slice(-n);
    return { start: selected[0].start, end: selected[selected.length - 1].end, cycleCount: n };
  }, [cycles, range]);

  const { data: expenses } = useQuery({
    enabled: !!householdId,
    queryKey: ["analysis", householdId, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, amount, category, occurred_at, kind")
        .eq("household_id", householdId!)
        .gte("occurred_at", start.toISOString())
        .lt("occurred_at", end.toISOString())
        .order("occurred_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });

  const { data: fixedRows = [] } = useQuery({
    enabled: !!householdId,
    queryKey: ["fixed-rows", householdId],
    queryFn: async () => {
      const [{ data: fx }, { data: dt }] = await Promise.all([
        supabase
          .from("fixed_expenses")
          .select("monthly_amount, category, label")
          .eq("household_id", householdId!),
        supabase.from("debts").select("monthly_amount, label").eq("household_id", householdId!),
      ]);
      const fixed = (fx ?? []) as Array<{
        monthly_amount: number | string;
        category: string | null;
        label: string;
      }>;
      const debts = ((dt ?? []) as Array<{ monthly_amount: number | string; label: string }>).map(
        (d) => ({
          monthly_amount: d.monthly_amount,
          category: "debt",
          label: d.label,
        }),
      );
      return [...fixed, ...debts];
    },
  });
  const fixedTotal = useMemo(
    () => fixedRows.reduce((s, r) => s + Number(r.monthly_amount), 0),
    [fixedRows],
  );

  // ---- Burndown (current pay cycle) ----
  const { data: cycleData } = useQuery({
    enabled: !!householdId,
    queryKey: ["burndown-cycle", householdId],
    queryFn: async () => {
      const [{ data: salaries }, { data: buckets }, { data: incomesRows }] = await Promise.all([
        supabase
          .from("expenses")
          .select("occurred_at")
          .eq("household_id", householdId!)
          .eq("is_salary", true)
          .order("occurred_at", { ascending: false })
          .limit(6),
        supabase.from("buckets").select("*").eq("household_id", householdId!),
        supabase.from("incomes").select("monthly_amount").eq("household_id", householdId!),
      ]);
      const cycle = computeCycle((salaries ?? []).map((r) => r.occurred_at as string));
      const { data: cycleTx } = await supabase
        .from("expenses")
        .select("amount, occurred_at, kind, is_salary, category, note, merchant")
        .eq("household_id", householdId!)
        .gte("occurred_at", cycle.start.toISOString())
        .lt("occurred_at", cycle.end.toISOString())
        .order("occurred_at", { ascending: true });
      // Cash-affecting movements in this cycle (deposits out, withdrawals in,
      // cash-sourced debt payments out). Transfers and bucket-sourced payments
      // don't touch cash, so they're excluded.
      const { data: cashMoves } = await supabase
        .from("account_movements")
        .select("amount, created_at, from_type, to_type, reason")
        .eq("household_id", householdId!)
        .gte("created_at", cycle.start.toISOString())
        .lt("created_at", cycle.end.toISOString())
        .or("from_type.eq.cash,to_type.eq.cash")
        .order("created_at", { ascending: true });
      const monthlyIncome = (incomesRows ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      const surplus = Math.max(0, monthlyIncome - baseline);
      function monthsUntil(dateStr: string | null): number {
        if (!dateStr) return 0;
        const target = new Date(dateStr);
        const n = new Date();
        const m =
          (target.getFullYear() - n.getFullYear()) * 12 +
          (target.getMonth() - n.getMonth()) +
          (target.getDate() >= n.getDate() ? 0 : -1) +
          1;
        return Math.max(1, m);
      }
      type BucketAlloc = {
        target_type: string;
        target_value: number | string;
        target_deadline: string | null;
      };
      const totalAllocated = ((buckets ?? []) as BucketAlloc[]).reduce((s, b) => {
        const v = Number(b.target_value);
        if (b.target_type === "pct_surplus") return s + (surplus * v) / 100;
        if (b.target_type === "fixed_monthly") return s + v;
        if (b.target_type === "fixed_yearly") return s + v / 12;
        return s + v / monthsUntil(b.target_deadline);
      }, 0);
      const unallocated = Math.max(0, surplus - totalAllocated);
      return {
        cycle,
        monthlyIncome,
        tx: (cycleTx ?? []) as Array<{
          amount: string | number;
          occurred_at: string;
          kind: "expense" | "income";
          is_salary: boolean;
          category: string;
          note: string | null;
          merchant: string | null;
        }>,
        unallocated,
        bucketTargets: totalAllocated,
        surplus,
        movements: (cashMoves ?? []) as Array<{
          amount: string | number;
          created_at: string;
          from_type: string | null;
          to_type: string | null;
          reason: string | null;
        }>,
      };
    },
  });

  type BurnEvent = {
    kind: "income" | "expense" | "fixed";
    label: string;
    amount: number;
    delta: number;
  };
  type BurnPoint = { label: string; iso: string; balance: number; events: BurnEvent[] };

  const burnSeries = useMemo<BurnPoint[]>(() => {
    if (!cycleData) return [];
    const { cycle, tx, movements } = cycleData;
    type Evt = {
      time: number;
      iso: string;
      kind: "income" | "expense";
      label: string;
      amount: number;
      delta: number;
      isSalary: boolean;
    };
    const txEvts: Evt[] = tx.map((ev) => {
      const amt = Number(ev.amount);
      return {
        time: +new Date(ev.occurred_at),
        iso: ev.occurred_at,
        kind: ev.kind,
        label: ev.is_salary
          ? ev.note || ev.merchant || t("ana.salaryFallback")
          : ev.note ||
            ev.merchant ||
            ev.category ||
            (ev.kind === "income" ? t("ana.incomeFallback") : t("ana.expenseFallback")),
        amount: amt,
        delta: ev.kind === "income" ? amt : -amt,
        isSalary: ev.is_salary,
      };
    });
    const mvEvts: Evt[] = (movements ?? []).map((m) => {
      const amt = Number(m.amount);
      const inflow = m.to_type === "cash"; // money returning to cash (withdrawal)
      return {
        time: +new Date(m.created_at),
        iso: m.created_at,
        kind: inflow ? "income" : "expense",
        label: m.reason || (inflow ? t("ana.incomeFallback") : t("ana.expenseFallback")),
        amount: amt,
        delta: inflow ? amt : -amt,
        isSalary: false,
      };
    });
    const events = [...txEvts, ...mvEvts].sort((a, b) => a.time - b.time);
    let bal = 0;
    const out: BurnPoint[] = [];
    out.push({
      label: fmt(cycle.start, "dd/MM"),
      iso: cycle.start.toISOString(),
      balance: 0,
      events: [{ kind: "expense", label: t("ana.cycleStart"), amount: 0, delta: 0 }],
    });
    let fixedReserved = false;
    for (const ev of events) {
      bal += ev.delta;
      out.push({
        label: fmt(new Date(ev.iso), "dd/MM HH:mm"),
        iso: ev.iso,
        balance: Number(bal.toFixed(2)),
        events: [{ kind: ev.kind, label: ev.label, amount: ev.amount, delta: ev.delta }],
      });
      if (!fixedReserved && ev.isSalary && fixedTotal > 0) {
        bal -= fixedTotal;
        out.push({
          label: fmt(new Date(ev.iso), "dd/MM HH:mm") + " · fixed",
          iso: ev.iso,
          balance: Number(bal.toFixed(2)),
          events: [
            {
              kind: "fixed",
              label: t("ana.fixedExpensesReserved"),
              amount: fixedTotal,
              delta: -fixedTotal,
            },
          ],
        });
        fixedReserved = true;
      }
    }
    const nowOrEnd = new Date(Math.min(Date.now(), cycle.end.getTime()));
    out.push({
      label: fmt(nowOrEnd, "dd/MM"),
      iso: nowOrEnd.toISOString(),
      balance: Number(bal.toFixed(2)),
      events: [],
    });
    return out;
  }, [cycleData, fixedTotal, t]);

  const onlySpend = useMemo(() => (expenses ?? []).filter((e) => e.kind === "expense"), [expenses]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of onlySpend) {
      map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount));
    }
    if (includeFixed && fixedRows.length) {
      for (const r of fixedRows) {
        const cat = (r.category?.trim() || r.label?.trim() || "fixed").toLowerCase();
        map.set(cat, (map.get(cat) ?? 0) + Number(r.monthly_amount) * cycleCount);
      }
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  }, [onlySpend, includeFixed, fixedRows, cycleCount]);

  const totalVariableSpend = onlySpend.reduce((s, e) => s + Number(e.amount), 0);
  const totalIncome = (expenses ?? [])
    .filter((e) => e.kind === "income")
    .reduce((s, e) => s + Number(e.amount), 0);

  // Fixed expenses over selected cycles (1 monthly amount per cycle)
  const proratedFixed = fixedTotal * cycleCount;
  const totalSpend = includeFixed ? totalVariableSpend + proratedFixed : totalVariableSpend;

  const cycleLabel = cycleCount === 1 ? "cycle" : "cycles";

  return (
    <div className={pageShellClass("6xl")}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display">{t("ana.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {cycleCount > 0
              ? t(cycleCount === 1 ? "ana.subtitle.cycle" : "ana.subtitle.cycles", {
                  n: cycleCount,
                })
              : ""}
            {t("ana.subtitle.range", {
              start: fmtDate(start),
              end: fmtDate(end),
              n: onlySpend.length,
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{t("ana.range.1")}</SelectItem>
              <SelectItem value="2">{t("ana.range.2")}</SelectItem>
              <SelectItem value="3">{t("ana.range.3")}</SelectItem>
              <SelectItem value="6">{t("ana.range.6")}</SelectItem>
              <SelectItem value="12">{t("ana.range.12")}</SelectItem>
              <SelectItem value="all">{t("ana.range.all")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {householdId && <CoachPanel householdId={householdId} initialPrompt={initialAsk} />}

      {fixedTotal > 0 && (
        <Label className="flex items-center gap-2 cursor-pointer text-sm w-fit">
          <Checkbox checked={includeFixed} onCheckedChange={(v) => setIncludeFixed(!!v)} />
          <span>
            {t("ana.includeFixed")}
            <span className="text-muted-foreground ml-1">
              (+{money(proratedFixed)} · {money(fixedTotal)}/mo × {cycleCount} {cycleLabel})
            </span>
          </span>
        </Label>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat
          label={includeFixed ? t("ana.stat.spentIncl") : t("ana.stat.spent")}
          value={money(totalSpend)}
        />
        <Stat label={t("ana.stat.received")} value={money(totalIncome)} />
        <Stat label={t("ana.stat.net")} value={money(totalIncome - totalSpend)} highlight />
      </div>

      {cycleData && (
        <Card>
          <CardHeader>
            <CardTitle>{t("ana.burndown.title")}</CardTitle>
            <CardDescription>
              Pay cycle {fmtDate(cycleData.cycle.start)} → {fmtDate(cycleData.cycle.end)}
              {cycleData.cycle.predicted ? " (predicted)" : ""} · starts at 0, jumps with salary,
              then fixed expenses ({money(fixedTotal)}) are reserved
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!burnSeries.length ? (
              <p className="text-sm text-muted-foreground py-10 text-center">
                {t("ana.noActivity")}
              </p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={burnSeries}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      interval="preserveStartEnd"
                      minTickGap={20}
                    />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                    <Tooltip content={<BurnTooltip />} />
                    <Area
                      type="stepAfter"
                      dataKey="balance"
                      name={t("ana.balanceLegend")}
                      stroke="var(--primary)"
                      fill="var(--primary)"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                    <ReferenceLine
                      y={0}
                      stroke="hsl(var(--destructive))"
                      strokeWidth={1}
                      strokeDasharray="2 2"
                      label={{
                        value: t("ana.emptyOverdraft"),
                        position: "insideBottomRight",
                        fontSize: 10,
                        fill: "hsl(var(--destructive))",
                      }}
                    />
                    {cycleData.bucketTargets > 0 && (
                      <ReferenceLine
                        y={cycleData.bucketTargets}
                        stroke="#b45309"
                        strokeWidth={1.5}
                        strokeDasharray="6 4"
                        label={{
                          value: t("ana.bucketFundingFloor", {
                            amount: money(cycleData.bucketTargets),
                          }),
                          position: "insideTopRight",
                          fontSize: 10,
                          fill: "#b45309",
                        }}
                      />
                    )}
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {householdId && cycleCount > 0 && (
        <BenchmarksCard
          householdId={householdId}
          monthlyIncome={cycleData?.monthlyIncome ?? 0}
          monthlySpend={totalSpend / cycleCount}
          spendByCategory={Object.fromEntries(
            byCategory.map((c) => [c.name, c.value / cycleCount]),
          )}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>By category</CardTitle>
          <CardDescription>Where your spending went.</CardDescription>
        </CardHeader>
        <CardContent>
          {!byCategory.length ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              No expenses in this range.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byCategory}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={100}
                      paddingAngle={1}
                    >
                      {byCategory.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, n) => [money(v), n as string]}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="divide-y">
                {byCategory.map((c, i) => {
                  const denom = includeFixed ? totalSpend : totalVariableSpend;
                  const pct = denom > 0 ? (c.value / denom) * 100 : 0;
                  return (
                    <li key={c.name} className="flex items-center justify-between py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ background: COLORS[i % COLORS.length] }}
                        />
                        <span className="capitalize">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                      </div>
                      <span className="tabular-nums font-medium">{money(c.value)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/5" : ""}>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-2xl font-display mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
