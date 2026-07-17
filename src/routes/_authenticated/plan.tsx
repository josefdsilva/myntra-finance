import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { invalidateHouseholdData } from "@/lib/household-queries";
import { upsertPlan, deletePlan, fundPlanAsProject } from "@/lib/plan.functions";
import { buildForecast, plansForMonth, monthKey, type Plan } from "@/lib/plan";
import { pageShellClass } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Plus, Trash2, PiggyBank, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({ meta: [{ title: "Plan · bynku" }] }),
  component: PlanPage,
});

type PlanRow = Plan & { note: string | null };

const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" });

function PlanPage() {
  const t = useT();
  const qc = useQueryClient();
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const upsertFn = useServerFn(upsertPlan);
  const deleteFn = useServerFn(deletePlan);
  const fundFn = useServerFn(fundPlanAsProject);

  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () => fetchHh({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
  });
  const householdId = hh?.household?.id;
  const baseline = Number(hh?.household?.baseline_budget ?? 0);

  const { data, refetch } = useQuery({
    enabled: !!householdId,
    queryKey: ["plans", householdId],
    queryFn: async () => {
      const [{ data: plans }, { data: incomes }] = await Promise.all([
        supabase.from("plans").select("*").eq("household_id", householdId!).order("month"),
        supabase.from("incomes").select("monthly_amount").eq("household_id", householdId!),
      ]);
      return {
        plans: (plans ?? []) as PlanRow[],
        monthlyIncome: (incomes ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0),
      };
    },
  });

  const plans = useMemo(() => data?.plans ?? [], [data?.plans]);
  const monthlyIncome = data?.monthlyIncome ?? 0;
  const forecast = useMemo(
    () => buildForecast({ plans, baseline, monthlyIncome, months: 6 }),
    [plans, baseline, monthlyIncome],
  );

  // Add-plan form.
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"spend" | "income">("spend");
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [recurrence, setRecurrence] = useState<"one_off" | "annual" | "ongoing">("one_off");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!householdId || !label || !amount) return;
    setBusy(true);
    try {
      await upsertFn({
        data: {
          household_id: householdId,
          label,
          amount: parseFloat(amount) || 0,
          direction,
          month: `${month}-01`,
          recurrence,
        },
      });
      setLabel("");
      setAmount("");
      refetch();
      toast.success(t("plan.saved"));
    } catch {
      toast.error(t("plan.errGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await deleteFn({ data: { id } });
    refetch();
  }

  async function fund(id: string) {
    if (!householdId) return;
    setBusy(true);
    try {
      await fundFn({ data: { id, household_id: householdId } });
      refetch();
      invalidateHouseholdData(qc);
      qc.invalidateQueries({ queryKey: ["buckets", householdId] });
      toast.success(t("plan.fundedToast"));
    } catch {
      toast.error(t("plan.errGeneric"));
    } finally {
      setBusy(false);
    }
  }

  // Upcoming plans grouped by month (next 12 months of activity, undone).
  const upcomingMonths = useMemo(() => {
    const now = new Date();
    const out: Array<{ ym: string; items: PlanRow[] }> = [];
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const ym = monthKey(d);
      const items = plansForMonth(plans, ym) as PlanRow[];
      if (items.length) out.push({ ym, items });
    }
    return out;
  }, [plans]);

  return (
    <div className={pageShellClass("5xl")}>
      <header>
        <h1 className="text-3xl md:text-4xl font-display">{t("plan.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("plan.subtitle")}</p>
      </header>

      {/* Add a plan */}
      <Card>
        <CardHeader>
          <CardTitle>{t("plan.addTitle")}</CardTitle>
          <CardDescription>{t("plan.addDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t("plan.label")}</Label>
              <Input
                placeholder={t("plan.labelHint")}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">{t("plan.amount")}</Label>
              <Input
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">{t("plan.kind")}</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spend">{t("plan.spend")}</SelectItem>
                  <SelectItem value="income">{t("plan.income")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("plan.month")}</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t("plan.recurrence")}</Label>
              <Select
                value={recurrence}
                onValueChange={(v) => setRecurrence(v as typeof recurrence)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_off">{t("plan.once")}</SelectItem>
                  <SelectItem value="annual">{t("plan.annual")}</SelectItem>
                  <SelectItem value="ongoing">{t("plan.ongoing")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={add} disabled={busy || !label || !amount}>
              <Plus className="size-4" /> {t("plan.add")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Forecast */}
      <Card>
        <CardHeader>
          <CardTitle>{t("plan.forecastTitle")}</CardTitle>
          <CardDescription>{t("plan.forecastDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground text-left">
                  <th className="py-1 pr-3 font-medium">{t("plan.colMonth")}</th>
                  <th className="py-1 px-3 font-medium text-right">{t("plan.colIncome")}</th>
                  <th className="py-1 px-3 font-medium text-right">{t("plan.colBaseline")}</th>
                  <th className="py-1 px-3 font-medium text-right">{t("plan.colPlanned")}</th>
                  <th className="py-1 pl-3 font-medium text-right">{t("plan.colLeftover")}</th>
                </tr>
              </thead>
              <tbody>
                {forecast.map((m) => (
                  <tr key={m.ym} className="border-t">
                    <td className="py-2 pr-3 capitalize">{monthLabel(m.ym)}</td>
                    <td className="py-2 px-3 tabular-nums text-right">{money(m.income)}</td>
                    <td className="py-2 px-3 tabular-nums text-right text-muted-foreground">
                      {money(m.baseline)}
                    </td>
                    <td className="py-2 px-3 tabular-nums text-right">
                      {m.plannedSpend > 0 ? money(m.plannedSpend) : "—"}
                    </td>
                    <td
                      className={`py-2 pl-3 tabular-nums text-right font-medium ${
                        m.shortfall ? "text-destructive" : ""
                      }`}
                    >
                      {money(m.leftover)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {forecast.some((m) => m.shortfall) && (
            <p className="mt-3 flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="size-4 shrink-0" /> {t("plan.shortfallNote")}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{t("plan.fundHint")}</p>
        </CardContent>
      </Card>

      {/* Upcoming plans list */}
      <Card>
        <CardHeader>
          <CardTitle>{t("plan.listTitle")}</CardTitle>
          <CardDescription>{t("plan.listDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {upcomingMonths.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">{t("plan.listEmpty")}</p>
          ) : (
            upcomingMonths.map(({ ym, items }) => (
              <div key={ym} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground capitalize">
                  {monthLabel(ym)}
                </p>
                <ul className="divide-y">
                  {items.map((p) => (
                    <li key={`${p.id}-${ym}`} className="flex items-center justify-between gap-2 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {p.direction === "income" ? (
                          <TrendingUp className="size-4 text-emerald-600 shrink-0" />
                        ) : (
                          <TrendingDown className="size-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate">{p.label}</span>
                        {p.recurrence !== "one_off" && (
                          <Badge variant="outline" className="text-[10px]">
                            {t(p.recurrence === "annual" ? "plan.annual" : "plan.ongoing")}
                          </Badge>
                        )}
                        {p.bucket_id && (
                          <Badge variant="outline" className="text-[10px] text-emerald-600">
                            {t("plan.funded")}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="tabular-nums font-medium">
                          {p.direction === "income" ? "+" : ""}
                          {money(Number(p.amount))}
                        </span>
                        {p.direction === "spend" && !p.bucket_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => fund(p.id)}
                          >
                            <PiggyBank className="size-4" /> {t("plan.fund")}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
