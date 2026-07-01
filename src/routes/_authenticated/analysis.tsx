import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { money, fmtDate } from "@/lib/format";
import {
  ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, CartesianGrid,
  ReferenceLine, PieChart, Pie, Cell, Legend, Area,
} from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { format as fmt, subDays, subMonths } from "date-fns";
import { computeCycle } from "@/lib/cycle";


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

type RangeKey = "30d" | "90d" | "6m" | "12m" | "ytd";

function AnalysisPage() {
  const fetchHh = useServerFn(getOrCreateHousehold);
  const { data: hh } = useQuery({ queryKey: ["household"], queryFn: () => fetchHh() });
  const householdId = hh?.household?.id;
  const baseline = Number(hh?.household?.baseline_budget ?? 0);

  const [range, setRange] = useState<RangeKey>("30d");
  const [includeFixed, setIncludeFixed] = useState(true);


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

  const { data: fixedRows = [] } = useQuery({
    enabled: !!householdId,
    queryKey: ["fixed-rows", householdId],
    queryFn: async () => {
      const { data } = await supabase
        .from("fixed_expenses").select("monthly_amount, category, label").eq("household_id", householdId!);
      return (data ?? []) as Array<{ monthly_amount: number | string; category: string | null; label: string }>;
    },
  });
  const fixedTotal = useMemo(() => fixedRows.reduce((s, r) => s + Number(r.monthly_amount), 0), [fixedRows]);
  


  // ---- Burndown (current pay cycle) ----
  const { data: cycleData } = useQuery({
    enabled: !!householdId,
    queryKey: ["burndown-cycle", householdId],
    queryFn: async () => {
      const [{ data: salaries }, { data: buckets }, { data: incomesRows }] = await Promise.all([
        supabase.from("expenses").select("occurred_at")
          .eq("household_id", householdId!).eq("is_salary", true)
          .order("occurred_at", { ascending: false }).limit(6),
        supabase.from("buckets").select("*").eq("household_id", householdId!),
        supabase.from("incomes").select("monthly_amount").eq("household_id", householdId!),
      ]);
      const cycle = computeCycle((salaries ?? []).map((r) => r.occurred_at as string));
      const { data: cycleTx } = await supabase
        .from("expenses")
        .select("amount, occurred_at, kind, is_salary, category, label")
        .eq("household_id", householdId!)
        .gte("occurred_at", cycle.start.toISOString())
        .lt("occurred_at", cycle.end.toISOString())
        .order("occurred_at", { ascending: true });
      const monthlyIncome = (incomesRows ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      const surplus = Math.max(0, monthlyIncome - baseline);
      function monthsUntil(dateStr: string | null): number {
        if (!dateStr) return 0;
        const target = new Date(dateStr);
        const n = new Date();
        const m = (target.getFullYear() - n.getFullYear()) * 12 + (target.getMonth() - n.getMonth()) + (target.getDate() >= n.getDate() ? 0 : -1) + 1;
        return Math.max(1, m);
      }
      const totalAllocated = (buckets ?? []).reduce((s: number, b: any) => {
        const v = Number(b.target_value);
        if (b.target_type === "pct_surplus") return s + (surplus * v) / 100;
        if (b.target_type === "fixed_monthly") return s + v;
        if (b.target_type === "fixed_yearly") return s + v / 12;
        return s + v / monthsUntil(b.target_deadline);
      }, 0);
      const unallocated = Math.max(0, surplus - totalAllocated);
      return {
        cycle,
        tx: (cycleTx ?? []) as Array<{ amount: string | number; occurred_at: string; kind: "expense" | "income"; is_salary: boolean }>,
        unallocated,
        bucketTargets: totalAllocated,
        surplus,
      };
    },
  });

  const burnSeries = useMemo(() => {
    if (!cycleData) return [];
    const { cycle, tx } = cycleData;
    const events = [...tx].sort((a, b) => +new Date(a.occurred_at) - +new Date(b.occurred_at));
    let bal = 0;
    const out: { label: string; iso: string; balance: number }[] = [];
    // Point 1: cycle start at zero.
    out.push({ label: fmt(cycle.start, "dd/MM"), iso: cycle.start.toISOString(), balance: 0 });
    let fixedReserved = false;
    for (const ev of events) {
      const amt = Number(ev.amount);
      bal += ev.kind === "income" ? amt : -amt;
      out.push({
        label: fmt(new Date(ev.occurred_at), "dd/MM HH:mm"),
        iso: ev.occurred_at,
        balance: Number(bal.toFixed(2)),
      });
      // Right after the first salary lands, reserve fixed expenses in one step.
      if (!fixedReserved && ev.is_salary && fixedTotal > 0) {
        bal -= fixedTotal;
        out.push({
          label: fmt(new Date(ev.occurred_at), "dd/MM HH:mm") + " · fixed",
          iso: ev.occurred_at,
          balance: Number(bal.toFixed(2)),
        });
        fixedReserved = true;
      }
    }
    const nowOrEnd = new Date(Math.min(Date.now(), cycle.end.getTime()));
    out.push({ label: fmt(nowOrEnd, "dd/MM"), iso: nowOrEnd.toISOString(), balance: Number(bal.toFixed(2)) });
    return out;
  }, [cycleData, fixedTotal]);

  const onlySpend = useMemo(() => (expenses ?? []).filter((e) => e.kind === "expense"), [expenses]);




  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of onlySpend) {
      map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount));
    }
    if (includeFixed && fixedRows.length) {
      const monthsInRangeLocal = Math.max(0, (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
      for (const r of fixedRows) {
        const cat = (r.category?.trim() || r.label?.trim() || "fixed").toLowerCase();
        map.set(cat, (map.get(cat) ?? 0) + Number(r.monthly_amount) * monthsInRangeLocal);
      }
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  }, [onlySpend, includeFixed, fixedRows, start]);



  const totalVariableSpend = onlySpend.reduce((s, e) => s + Number(e.amount), 0);
  const totalIncome = (expenses ?? []).filter((e) => e.kind === "income").reduce((s, e) => s + Number(e.amount), 0);

  // Prorated fixed expenses across the range
  const monthsInRange = Math.max(0, (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
  const proratedFixed = fixedTotal * monthsInRange;
  const totalSpend = includeFixed ? totalVariableSpend + proratedFixed : totalVariableSpend;

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

      {fixedTotal > 0 && (
        <Label className="flex items-center gap-2 cursor-pointer text-sm w-fit">
          <Checkbox checked={includeFixed} onCheckedChange={(v) => setIncludeFixed(!!v)} />
          <span>
            Include fixed expenses
            <span className="text-muted-foreground ml-1">
              (+{money(proratedFixed)} prorated · {money(fixedTotal)}/mo × {monthsInRange.toFixed(1)} mo)
            </span>
          </span>
        </Label>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label={includeFixed ? "Total spent (incl. fixed)" : "Total spent"} value={money(totalSpend)} />
        <Stat label="Received" value={money(totalIncome)} />
        <Stat label="Net" value={money(totalIncome - totalSpend)} highlight />
      </div>

      {cycleData && (
        <Card>
          <CardHeader>
            <CardTitle>Cycle burndown</CardTitle>
            <CardDescription>
              Pay cycle {fmtDate(cycleData.cycle.start)} → {fmtDate(cycleData.cycle.end)}
              {cycleData.cycle.predicted ? " (predicted)" : ""} · starts at 0, jumps with salary, then fixed expenses ({money(fixedTotal)}) are reserved
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!burnSeries.length ? (
              <p className="text-sm text-muted-foreground py-10 text-center">No activity in this cycle yet.</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={burnSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={20} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                    <Tooltip formatter={(v: number) => money(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                    <Area type="stepAfter" dataKey="balance" name="Balance" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.15} strokeWidth={2} />
                    <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeWidth={1} strokeDasharray="2 2"
                      label={{ value: "Empty (overdraft below)", position: "insideBottomRight", fontSize: 10, fill: "hsl(var(--destructive))" }} />
                    {cycleData.bucketTargets > 0 && (
                      <ReferenceLine y={cycleData.bucketTargets} stroke="#b45309" strokeWidth={1.5} strokeDasharray="6 4"
                        label={{ value: `Bucket funding floor ${money(cycleData.bucketTargets)} (don't spend below)`, position: "insideTopRight", fontSize: 10, fill: "#b45309" }} />
                    )}
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}






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
                  const denom = includeFixed ? totalSpend : totalVariableSpend;
                  const pct = denom > 0 ? (c.value / denom) * 100 : 0;
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
