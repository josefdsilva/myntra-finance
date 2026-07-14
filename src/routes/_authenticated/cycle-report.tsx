import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { buildCyclesFromSalaries, type CycleSpan } from "@/lib/cycle";
import { generateCycleReportNarrative } from "@/lib/cycle-report.functions";
import { upsertVariableEstimate } from "@/lib/budget.functions";
import { useLocale, useT } from "@/lib/i18n";
import { money, fmtDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { IncomeAllocationSuggestion } from "@/components/income-allocation-suggestion";
import { Printer, RefreshCw, Loader2, PiggyBank, Wallet, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cycle-report")({
  head: () => ({ meta: [{ title: "Cycle report · Myntra" }] }),
  component: CycleReportPage,
});

function CycleReportPage() {
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const locale = useLocale();
  const qc = useQueryClient();
  const genFn = useServerFn(generateCycleReportNarrative);
  const upsertEstimate = useServerFn(upsertVariableEstimate);
  const t = useT();

  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () => fetchHh({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
  });
  const householdId = hh?.household?.id;

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

  const cycles = useMemo(() => buildCyclesFromSalaries(salaryAsc), [salaryAsc]);
  // A cycle is "closed" once a later salary bounded it — the last entry is the
  // ongoing cycle with a predicted end, so it's excluded from the picker.
  const closedCycles = useMemo(() => cycles.filter((c) => !c.predicted), [cycles]);

  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!selected && closedCycles.length) {
      setSelected(closedCycles[closedCycles.length - 1].start.toISOString());
    }
  }, [closedCycles, selected]);

  const selectedCycle: CycleSpan | undefined = closedCycles.find(
    (c) => c.start.toISOString() === selected,
  );

  const reportQ = useQuery({
    enabled: !!householdId && !!selectedCycle,
    queryKey: ["cycle-report", householdId, selectedCycle?.start.toISOString(), locale],
    queryFn: () =>
      genFn({
        data: {
          householdId: householdId!,
          cycleStart: selectedCycle!.start.toISOString(),
          cycleEnd: selectedCycle!.end.toISOString(),
          locale,
        },
      }),
  });

  const [refreshing, setRefreshing] = useState(false);
  async function regenerate() {
    if (!householdId || !selectedCycle) return;
    setRefreshing(true);
    try {
      await genFn({
        data: {
          householdId,
          cycleStart: selectedCycle.start.toISOString(),
          cycleEnd: selectedCycle.end.toISOString(),
          locale,
          refresh: true,
        },
      });
      qc.invalidateQueries({
        queryKey: ["cycle-report", householdId, selectedCycle.start.toISOString(), locale],
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("cycleReport.regenerateFailed"));
    } finally {
      setRefreshing(false);
    }
  }

  const [applying, setApplying] = useState<string | null>(null);
  async function applySuggestion(row: {
    category: string;
    estimateId: string | null;
    estimateLabel: string;
    suggested: number;
  }) {
    if (!householdId) return;
    setApplying(row.category);
    try {
      await upsertEstimate({
        data: {
          id: row.estimateId ?? undefined,
          household_id: householdId,
          label: row.estimateLabel,
          category: row.category,
          monthly_amount: row.suggested,
        },
      });
      toast.success(
        t("cycleReport.estimateUpdatedToast", {
          label: row.estimateLabel,
          amount: money(row.suggested),
        }),
      );
      qc.invalidateQueries({ queryKey: ["cycle-report", householdId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("cycleReport.applyFailed"));
    } finally {
      setApplying(null);
    }
  }

  const [surplusOpen, setSurplusOpen] = useState(false);
  const stats = reportQ.data?.stats;
  const leftover = stats?.leftoverSurplus ?? 0;

  if (householdId && closedCycles.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PiggyBank className="size-5" /> {t("cycleReport.title")}
            </CardTitle>
            <CardDescription>{t("cycleReport.noClosedCycle")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-2xl">{t("cycleReport.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("cycleReport.printSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {closedCycles.length > 0 && (
            <Select value={selected ?? undefined} onValueChange={setSelected}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder={t("cycleReport.selectCyclePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {[...closedCycles].reverse().map((c) => (
                  <SelectItem key={c.start.toISOString()} value={c.start.toISOString()}>
                    {fmtDate(c.start)} – {fmtDate(c.end)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={regenerate} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {t("cycleReport.regenerate")}
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> {t("cycleReport.printSave")}
          </Button>
        </div>
      </div>

      {!selectedCycle || reportQ.isLoading || !stats ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="hidden print:block">
            <h1 className="font-display text-2xl">{t("cycleReport.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {fmtDate(selectedCycle.start)} – {fmtDate(selectedCycle.end)} ·{" "}
              {t("cycleReport.generatedPrefix")}{" "}
              {new Date(reportQ.data!.generated_at).toLocaleString()}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("cycleReport.summary")}</CardTitle>
              <CardDescription>
                {fmtDate(selectedCycle.start)} – {fmtDate(selectedCycle.end)} ({stats.cycleDays}{" "}
                {t("cycleReport.days")})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <Stat label={t("cycleReport.incomeLabel")} value={money(stats.actualIncome)} />
                <Stat
                  label={t("cycleReport.fixedBaselineLabel")}
                  value={money(stats.fixedMonthly)}
                />
                <Stat
                  label={t("cycleReport.variableSpentLabel")}
                  value={money(stats.actualVariableSpent)}
                  sub={t("cycleReport.ofPool", { pool: money(stats.variablePool) })}
                  warn={stats.actualVariableSpent > stats.variablePool}
                />
                <Stat
                  label={t("cycleReport.movedToBucketsLabel")}
                  value={money(stats.confirmedBucketAllocations)}
                />
              </div>
            </CardContent>
          </Card>

          {leftover > 0.5 && (
            <Card className="border-emerald-500/30 bg-emerald-500/5 print:hidden">
              <CardContent className="pt-6 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Wallet className="size-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-medium">
                      {t("cycleReport.leftOverBody", { amount: money(leftover) })}
                    </p>
                    <p className="text-sm text-muted-foreground">{t("cycleReport.leftOverHint")}</p>
                  </div>
                </div>
                <Button onClick={() => setSurplusOpen(true)}>
                  {t("cycleReport.decideWhatToDo")}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t("cycleReport.wentWellTitle")}</CardTitle>
              <CardDescription>{t("cycleReport.wentWellDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-semibold [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:my-1">
                <ReactMarkdown>{reportQ.data!.narrative}</ReactMarkdown>
              </div>
              <p className="text-xs text-muted-foreground mt-3 print:hidden">
                {reportQ.data!.cached
                  ? t("cycleReport.cachedLabel")
                  : t("cycleReport.freshlyGenerated")}{" "}
                · {t("cycleReport.generatedPrefix")}{" "}
                {new Date(reportQ.data!.generated_at).toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("cycleReport.varSpendingTitle")}</CardTitle>
              <CardDescription>{t("cycleReport.varSpendingDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("cycleReport.categoryHeader")}</TableHead>
                    <TableHead className="text-right">{t("cycleReport.estimateHeader")}</TableHead>
                    <TableHead className="text-right">{t("cycleReport.actualHeader")}</TableHead>
                    <TableHead className="text-right">Δ</TableHead>
                    <TableHead className="text-right">{t("cycleReport.suggestedHeader")}</TableHead>
                    <TableHead className="print:hidden" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.categories.map((row) => {
                    const meaningfulChange = Math.abs(row.suggested - row.estimate) >= 1;
                    return (
                      <TableRow key={row.category}>
                        <TableCell className="font-medium">{row.estimateLabel}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(row.estimate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(row.actualMonthly)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${row.delta > 0 ? "text-destructive" : "text-emerald-600"}`}
                        >
                          {row.delta > 0 ? "+" : ""}
                          {money(row.delta)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(row.suggested)}
                        </TableCell>
                        <TableCell className="print:hidden">
                          {meaningfulChange ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              disabled={applying === row.category}
                              onClick={() => applySuggestion(row)}
                            >
                              {applying === row.category ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Check className="size-3" />
                              )}
                              {t("cycleReport.apply")}
                            </Button>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {t("cycleReport.inLine")}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("cycleReport.bucketsTitle")}</CardTitle>
              <CardDescription>{t("cycleReport.bucketsDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("cycleReport.bucketHeader")}</TableHead>
                    <TableHead className="text-right">
                      {t("cycleReport.allocatedThisCycleHeader")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("cycleReport.currentBalanceHeader")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.buckets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground text-sm">
                        {t("cycleReport.noBucketsConfigured")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats.buckets.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {b.allocatedThisCycle > 0 ? (
                            money(b.allocatedThisCycle)
                          ) : (
                            <span className="text-muted-foreground">
                              {t("cycleReport.notConfirmed")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(b.currentBalance)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {stats.topSpends.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("cycleReport.biggestExpensesTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("cycleReport.dateHeader")}</TableHead>
                      <TableHead>{t("cycleReport.categoryHeader")}</TableHead>
                      <TableHead>{t("cycleReport.noteHeader")}</TableHead>
                      <TableHead className="text-right">{t("cycleReport.amountHeader")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.topSpends.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell>{fmtDate(s.occurred_at)}</TableCell>
                        <TableCell>{s.category}</TableCell>
                        <TableCell className="text-muted-foreground">{s.note ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(s.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {householdId && (
        <IncomeAllocationSuggestion
          householdId={householdId}
          amount={Math.max(0, leftover)}
          open={surplusOpen}
          onOpenChange={setSurplusOpen}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-display tabular-nums ${warn ? "text-destructive" : ""}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
