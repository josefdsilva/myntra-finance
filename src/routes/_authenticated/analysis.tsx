import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { money, fmtDate } from "@/lib/format";
import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ReferenceLine, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { startOfDay, startOfWeek, startOfMonth, format as fmt, subDays, subMonths } from "date-fns";

export const Route = createFileRoute("/_authenticated/analysis")({
  head: () => ({ meta: [{ title: "Analysis · Household Budget" }] }),
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
  "#2c6e6b", "#c89b6c", "#a05c4a", "#3d7d8a", "#8a6b3d",
  "#6b8a3d", "#5a4a8a", "#8a3d6b", "#3d5a8a", "#8a8a3d",
  "#5c7a99", "#99785c", "#7a5c99", "#99995c",
];

type Granularity = "day" | "week" | "month";
type RangeKey = "30d" | "90d" | "6m" | "12m" | "ytd";

function AnalysisPage() {
  const fetchHh = useServerFn(getOrCreateHousehold);
  const { data: hh } = useQuery({ queryKey: ["household"], queryFn: () => fetchHh() });
  const householdId = hh?.household?.id;
  const baseline = Number(hh?.household?.baseline_budget ?? 0);

  const [gran, setGran] = useState<Granularity>("day");
  const [range, setRange] = useState<RangeKey>("30d");
  const [showBaseline, setShowBaseline] = useState(true);
  const [showVariable, setShowVariable] = useState(true);
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [includeFixed, setIncludeFixed] = useState(false);

  const { start } = useMemo(() => {
    const now = new Date();
    switch (range) {
      case "30d": return { start: subDays(now, 30) };
      case "90d": return { start: subDays(now, 90) };
      case "6m": return { start: subMonths(now, 6) };
      case "12m": return { start: subMonths(now, 12) };
      case "ytd": return { start: new Date(now.getFullYear(), 0, 1) };
    }
  }, [range]);

  const { data: expenses } = useQuery({
    enabled: !!householdId,
    queryKey: ["analysis", householdId, start.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, amount, category, occurred_at, kind")
        .eq("household_id", householdId!)
        .gte("occurred_at", start.toISOString())
        .order("occurred_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });

  const { data: fixedTotal = 0 } = useQuery({
    enabled: !!householdId,
    queryKey: ["fixed-total", householdId],
    queryFn: async () => {
      const { data } = await supabase
        .from("fixed_expenses").select("monthly_amount").eq("household_id", householdId!);
      return (data ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
    },
  });
  const variablePool = Math.max(0, baseline - fixedTotal);

  // baseline scaled to current granularity (variable pool only — fixed expenses don't show up as daily spend)
  const scale = gran === "day" ? 1 / 30.4375 : gran === "week" ? 12 / 52 : 1;
  const baselineLine = baseline * scale;
  const variableLine = variablePool * scale;

  const onlySpend = useMemo(() => (expenses ?? []).filter((e) => e.kind === "expense"), [expenses]);

  const series = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of onlySpend) {
      const d = new Date(e.occurred_at);
      let bucket: Date;
      if (gran === "day") bucket = startOfDay(d);
      else if (gran === "week") bucket = startOfWeek(d, { weekStartsOn: 1 });
      else bucket = startOfMonth(d);
      const key = bucket.toISOString();
      map.set(key, (map.get(key) ?? 0) + Number(e.amount));
    }
    // Fill missing buckets between range start and today so the line is continuous
    const now = new Date();
    const stepMs = gran === "day" ? 86400000 : gran === "week" ? 7 * 86400000 : 0;
    const out: { label: string; total: number; iso: string }[] = [];
    function pushBucket(date: Date) {
      const iso = date.toISOString();
      const label = gran === "month"
        ? fmt(date, "MMM yyyy")
        : gran === "week"
        ? `W${fmt(date, "II")} ${fmt(date, "dd/MM")}`
        : fmt(date, "dd/MM");
      out.push({ label, iso, total: Number((map.get(iso) ?? 0).toFixed(2)) });
    }
    if (gran === "month") {
      let cur = startOfMonth(start);
      const end = startOfMonth(now);
      while (cur.getTime() <= end.getTime()) {
        pushBucket(new Date(cur));
        cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      }
    } else {
      let cur = gran === "day" ? startOfDay(start) : startOfWeek(start, { weekStartsOn: 1 });
      const end = gran === "day" ? startOfDay(now) : startOfWeek(now, { weekStartsOn: 1 });
      while (cur.getTime() <= end.getTime()) {
        pushBucket(new Date(cur));
        cur = new Date(cur.getTime() + stepMs);
      }
    }
    return out;
  }, [onlySpend, gran, start]);


  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of onlySpend) {
      map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  }, [onlySpend]);

  const totalSpend = onlySpend.reduce((s, e) => s + Number(e.amount), 0);
  const totalIncome = (expenses ?? []).filter((e) => e.kind === "income").reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display">Analysis</h1>
          <p className="text-sm text-muted-foreground">
            From {fmtDate(start)} · {onlySpend.length} expense{onlySpend.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="6m">Last 6 months</SelectItem>
              <SelectItem value="12m">Last 12 months</SelectItem>
              <SelectItem value="ytd">Year to date</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Total spent" value={money(totalSpend)} />
        <Stat label="Received" value={money(totalIncome)} />
        <Stat label="Net" value={money(totalIncome - totalSpend)} highlight />
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Spending over time</CardTitle>
              <CardDescription>
                One point per {gran}
                {baseline > 0 ? ` · baseline ≈ ${money(baselineLine)} / ${gran}` : ""}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={chartType} onValueChange={(v) => setChartType(v as "line" | "bar")}>
                <TabsList>
                  <TabsTrigger value="line">Line</TabsTrigger>
                  <TabsTrigger value="bar">Bar</TabsTrigger>
                </TabsList>
              </Tabs>
              <Tabs value={gran} onValueChange={(v) => setGran(v as Granularity)}>
                <TabsList>
                  <TabsTrigger value="day">Day</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
          {baseline > 0 && (
            <div className="flex flex-wrap gap-4 text-sm">
              <Label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={showBaseline} onCheckedChange={(v) => setShowBaseline(!!v)} />
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-4 bg-destructive" />
                  Baseline ({money(baselineLine)})
                </span>
              </Label>
              <Label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={showVariable} onCheckedChange={(v) => setShowVariable(!!v)} />
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-4 border-t-2 border-dashed border-amber-600" />
                  Variable pool — fixed expenses excluded ({money(variableLine)})
                </span>
              </Label>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!series.length ? (
            <p className="text-sm text-muted-foreground py-10 text-center">No expenses in this range.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={20} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                  <Tooltip formatter={(v: number) => money(v)} labelStyle={{ color: "var(--foreground)" }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  {chartType === "bar" ? (
                    <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  ) : (
                    <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                  )}
                  {baseline > 0 && showBaseline && (
                    <ReferenceLine y={baselineLine} stroke="hsl(var(--destructive))" strokeWidth={1.5} strokeDasharray="4 2"
                      label={{ value: "Baseline", position: "insideTopRight", fontSize: 10, fill: "hsl(var(--destructive))" }} />
                  )}
                  {baseline > 0 && showVariable && (
                    <ReferenceLine y={variableLine} stroke="#b45309" strokeWidth={1.5} strokeDasharray="6 4"
                      label={{ value: "Variable pool", position: "insideBottomRight", fontSize: 10, fill: "#b45309" }} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>By category</CardTitle>
          <CardDescription>Where your spending went.</CardDescription>
        </CardHeader>
        <CardContent>
          {!byCategory.length ? (
            <p className="text-sm text-muted-foreground py-10 text-center">No expenses in this range.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={100} paddingAngle={1}>
                      {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, n) => [money(v), n as string]} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="divide-y">
                {byCategory.map((c, i) => {
                  const pct = totalSpend > 0 ? (c.value / totalSpend) * 100 : 0;
                  return (
                    <li key={c.name} className="flex items-center justify-between py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
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
