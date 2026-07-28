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
import { FastForward, Loader2, Info, TrendingUp, Target, Plus, X, FlaskConical } from "lucide-react";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { fastForward } from "@/lib/projection.functions";
import type { ProjectionMonth, ScenarioEvent } from "@/lib/projection";
import { pageShellClass } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { money } from "@/lib/format";
import { useLocale, useT, type MessageKey } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/fast-forward")({
  head: () => ({ meta: [{ title: "Fast forward · bynku" }] }),
  component: FastForwardPage,
});

const MAX_MONTHS = 60;

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
  const [events, setEvents] = useState<ScenarioEvent[]>([]);

  const { data, isLoading } = useQuery({
    enabled: !!householdId,
    queryKey: ["fast-forward", householdId, target, JSON.stringify(events)],
    queryFn: () => runFn({ data: { householdId: householdId!, targetMonth: target, events } }),
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
    const bas = data.baseline?.series ?? [];
    const head = {
      ym: data.startYm,
      label: monthLabel(data.startYm),
      expected: data.current.netWorth,
      cautious: data.current.netWorth,
      optimistic: data.current.netWorth,
      baseline: data.current.netWorth,
    };
    const rest = exp.map((row, i) => ({
      ym: row.ym,
      label: monthLabel(row.ym),
      expected: row.netWorth,
      cautious: cau[i]?.netWorth ?? null,
      optimistic: opt[i]?.netWorth ?? null,
      baseline: bas[i]?.netWorth ?? null,
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
            onChange={(e) => {
              // "YYYY-MM" sorts chronologically as text, so clamp to the window.
              // Native mobile month pickers don't reliably enforce max/min.
              const v = e.target.value;
              if (!v) return;
              setTarget(v < minMonth ? minMonth : v > maxMonth ? maxMonth : v);
            }}
            className="w-full sm:w-48"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("ff.horizonHint", { date: monthLabel(maxMonth) })}
          </p>
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
              {data.hasEvents &&
                (() => {
                  const delta =
                    (byKey.expected?.at.netWorth ?? 0) - (data.baseline?.at.netWorth ?? 0);
                  const up = delta >= 0;
                  return (
                    <div
                      className={`mt-3 rounded-md px-3 py-2 text-sm ${up ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}
                    >
                      {t(up ? "ff.deltaUp" : "ff.deltaDown", { value: money(Math.abs(delta)) })}
                    </div>
                  );
                })()}
              <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" /> {t("ff.rangeNote")}
              </p>
            </CardContent>
          </Card>

          <ScenarioBuilder
            events={events}
            onChange={setEvents}
            debts={data.debts}
            minMonth={minMonth}
            maxMonth={maxMonth}
            defaultMonth={target}
          />

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
                    {data.hasEvents && (
                      <Line
                        type="monotone"
                        dataKey="baseline"
                        stroke="var(--muted-foreground)"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                    )}
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

type UiType =
  | "purchaseAsset"
  | "oneOffExpense"
  | "oneOffIncome"
  | "raise"
  | "recurringCost"
  | "loan"
  | "overpay";

const UI_TYPES: UiType[] = [
  "purchaseAsset",
  "oneOffExpense",
  "oneOffIncome",
  "raise",
  "recurringCost",
  "loan",
  "overpay",
];

function ScenarioBuilder({
  events,
  onChange,
  debts,
  minMonth,
  maxMonth,
  defaultMonth,
}: {
  events: ScenarioEvent[];
  onChange: (e: ScenarioEvent[]) => void;
  debts: Array<{ id: string; label: string }>;
  minMonth: string;
  maxMonth: string;
  defaultMonth: string;
}) {
  const t = useT();
  const locale = useLocale();
  const [type, setType] = useState<UiType>("oneOffExpense");
  const [month, setMonth] = useState(defaultMonth);
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [apr, setApr] = useState("");
  const [term, setTerm] = useState("");
  const [assetValue, setAssetValue] = useState("");
  const [targetDebtId, setTargetDebtId] = useState(debts[0]?.id ?? "");

  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, (m || 1) - 1, 1).toLocaleDateString(locale, { month: "short", year: "numeric" });
  };
  const num = (s: string) => {
    const n = parseFloat(s.replace(",", "."));
    return isFinite(n) ? n : 0;
  };
  const clampMonth = (v: string) => (v < minMonth ? minMonth : v > maxMonth ? maxMonth : v);

  const isRecurring = type === "raise" || type === "recurringCost";
  const amountKey =
    type === "loan"
      ? "ff.evt.principal"
      : type === "purchaseAsset"
        ? "ff.evt.price"
        : "ff.evt.amount";

  function add() {
    const amt = num(amount);
    if (amt <= 0) return;
    if (type === "overpay" && !targetDebtId) return;
    const id = crypto.randomUUID();
    const label = name.trim() || undefined;
    let ev: ScenarioEvent;
    switch (type) {
      case "purchaseAsset":
        ev = {
          id,
          kind: "asset_purchase",
          month,
          price: amt,
          assetValue: assetValue.trim() ? num(assetValue) : amt,
          label,
        };
        break;
      case "oneOffExpense":
        ev = { id, kind: "one_off", direction: "expense", month, amount: amt, label };
        break;
      case "oneOffIncome":
        ev = { id, kind: "one_off", direction: "income", month, amount: amt, label };
        break;
      case "raise":
        ev = { id, kind: "recurring", direction: "income", fromMonth: month, amount: amt, label };
        break;
      case "recurringCost":
        ev = { id, kind: "recurring", direction: "expense", fromMonth: month, amount: amt, label };
        break;
      case "loan":
        ev = {
          id,
          kind: "loan",
          month,
          principal: amt,
          aprPct: num(apr),
          termMonths: Math.max(1, Math.round(num(term)) || 12),
          label,
        };
        break;
      case "overpay":
        ev = { id, kind: "overpay", month, amount: amt, targetDebtId, label };
        break;
    }
    onChange([...events, ev]);
    setAmount("");
    setName("");
  }

  function summarise(e: ScenarioEvent): string {
    const m = e.kind === "recurring" ? e.fromMonth : e.month;
    const amt = e.kind === "loan" ? e.principal : e.kind === "asset_purchase" ? e.price : e.amount;
    const bits = [e.label, money(amt), monthLabel(m)].filter(Boolean);
    if (e.kind === "loan") bits.push(`${e.aprPct}% · ${e.termMonths}m`);
    if (e.kind === "overpay") bits.push(debts.find((d) => d.id === e.targetDebtId)?.label ?? "");
    return bits.filter(Boolean).join(" · ");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="size-4 text-primary" /> {t("ff.scenariosTitle")}
        </CardTitle>
        <CardDescription>{t("ff.scenariosDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {events.length > 0 && (
          <ul className="space-y-1.5">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                    {t(`ff.evt.type.${uiTypeOf(e)}` as MessageKey)}
                  </span>
                  <span className="truncate text-muted-foreground">{summarise(e)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onChange(events.filter((x) => x.id !== e.id))}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={t("common.dismiss")}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <Label className="text-xs">{t("ff.evt.type")}</Label>
            <Select value={type} onValueChange={(v) => setType(v as UiType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UI_TYPES.map((ut) => (
                  <SelectItem key={ut} value={ut}>
                    {t(`ff.evt.type.${ut}` as MessageKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t(isRecurring ? "ff.evt.from" : "ff.evt.month")}</Label>
            <Input
              type="month"
              value={month}
              min={minMonth}
              max={maxMonth}
              onChange={(e) => e.target.value && setMonth(clampMonth(e.target.value))}
            />
          </div>
          <div>
            <Label className="text-xs">{t(amountKey as MessageKey)}</Label>
            <Input
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">{t("ff.evt.nameOpt")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("ff.evt.namePh")} />
          </div>

          {type === "loan" && (
            <>
              <div>
                <Label className="text-xs">{t("ff.evt.apr")}</Label>
                <Input inputMode="decimal" placeholder="0" value={apr} onChange={(e) => setApr(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{t("ff.evt.term")}</Label>
                <Input inputMode="numeric" placeholder="60" value={term} onChange={(e) => setTerm(e.target.value)} />
              </div>
            </>
          )}
          {type === "purchaseAsset" && (
            <div>
              <Label className="text-xs">{t("ff.evt.assetValue")}</Label>
              <Input
                inputMode="decimal"
                placeholder={t("ff.evt.assetValuePh")}
                value={assetValue}
                onChange={(e) => setAssetValue(e.target.value)}
              />
            </div>
          )}
          {type === "overpay" && (
            <div>
              <Label className="text-xs">{t("ff.evt.target")}</Label>
              <Select value={targetDebtId} onValueChange={setTargetDebtId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("ff.evt.targetPh")} />
                </SelectTrigger>
                <SelectContent>
                  {debts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Button onClick={add} disabled={type === "overpay" && debts.length === 0}>
          <Plus className="size-4" /> {t("ff.evt.add")}
        </Button>
        {type === "overpay" && debts.length === 0 && (
          <p className="text-xs text-muted-foreground">{t("ff.evt.noDebts")}</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Map a stored event back to its friendly UI type (for the chip label). */
function uiTypeOf(e: ScenarioEvent): UiType {
  switch (e.kind) {
    case "asset_purchase":
      return "purchaseAsset";
    case "loan":
      return "loan";
    case "overpay":
      return "overpay";
    case "recurring":
      return e.direction === "income" ? "raise" : "recurringCost";
    case "one_off":
      return e.direction === "income" ? "oneOffIncome" : "oneOffExpense";
  }
}
