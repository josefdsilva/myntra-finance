import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mountain,
  Snowflake,
  TrendingDown,
  Clock,
  Trophy,
  ArrowUp,
  ArrowDown,
  RotateCcw,
} from "lucide-react";
import { money, fmtDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { debtLiveSchedule, type Debt } from "@/lib/debt-schedule";
import { simulatePayoff, payoffOrder, type Strategy, type LumpSum } from "@/lib/payoff-simulator";
import type { RecomputeMode } from "@/lib/movements";

export function PayoffSimulator({ householdId }: { householdId: string }) {
  const t = useT();
  const [strategy, setStrategy] = useState<Strategy>("avalanche");
  const [extra, setExtra] = useState<string>("100");
  const [lumpAmount, setLumpAmount] = useState<string>("");
  const [lumpMode, setLumpMode] = useState<RecomputeMode>("shorten_term");
  const [lumpDebtId, setLumpDebtId] = useState<string>("");
  const [customOrder, setCustomOrder] = useState<string[] | null>(null);

  const { data: debts } = useQuery({
    enabled: !!householdId,
    queryKey: ["payoff-simulator-debts", householdId],
    queryFn: async () => {
      const { data } = await supabase
        .from("debts")
        .select("*")
        .eq("household_id", householdId)
        .order("sort_order");
      return (data ?? []) as Debt[];
    },
  });

  const activeDebts = useMemo(
    () =>
      (debts ?? []).filter((d) => {
        const s = debtLiveSchedule(d);
        return !s.paidOff && s.remaining > 0 && Number(d.monthly_amount ?? 0) > 0;
      }),
    [debts],
  );

  const extraNum = Math.max(0, Number(extra.replace(",", ".")) || 0);
  const lumpNum = Math.max(0, Number(lumpAmount.replace(",", ".")) || 0);

  // Default lump-sum target = current top of order
  const strategyOrder = useMemo(
    () => payoffOrder(activeDebts, strategy),
    [activeDebts, strategy],
  );
  useEffect(() => {
    if (!lumpDebtId && strategyOrder[0]) setLumpDebtId(strategyOrder[0].id);
  }, [lumpDebtId, strategyOrder]);

  const lumpSum: LumpSum | null =
    lumpNum > 0 && lumpDebtId
      ? { debtId: lumpDebtId, amount: lumpNum, mode: lumpMode }
      : null;

  const effectiveOrder = useMemo(
    () => payoffOrder(activeDebts, strategy, new Date(), customOrder ?? undefined),
    [activeDebts, strategy, customOrder],
  );
  const orderIds = useMemo(() => effectiveOrder.map((d) => d.id), [effectiveOrder]);

  const baseline = useMemo(
    () => simulatePayoff({ debts: activeDebts, extraPerMonth: 0, strategy }),
    [activeDebts, strategy],
  );
  const withExtra = useMemo(
    () =>
      simulatePayoff({
        debts: activeDebts,
        extraPerMonth: extraNum,
        strategy,
        customOrder: customOrder ?? undefined,
        lumpSum,
      }),
    [activeDebts, extraNum, strategy, customOrder, lumpSum],
  );

  if (!debts) return null;
  if (activeDebts.length === 0) return null;

  const monthsSaved = Math.max(0, baseline.months - withExtra.months);
  const interestSaved = Math.max(0, baseline.totalInterest - withExtra.totalInterest);
  const yearsSaved = Math.floor(monthsSaved / 12);
  const remMonths = monthsSaved % 12;

  const relPct =
    baseline.months > 0 ? Math.min(100, (withExtra.months / baseline.months) * 100) : 0;

  const moveOrder = (idx: number, delta: number) => {
    const next = [...orderIds];
    const j = idx + delta;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setCustomOrder(next);
  };

  const isCustom = customOrder !== null;

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="size-5" /> {t("payoff.title")}
        </CardTitle>
        <CardDescription>{t("payoff.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 px-0 pb-0">
        {/* Strategy tabs */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("payoff.strategyLabel")}
          </Label>
          <Tabs value={strategy} onValueChange={(v) => setStrategy(v as Strategy)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="avalanche" className="gap-1.5">
                <Mountain className="size-4" /> {t("payoff.avalanche")}
              </TabsTrigger>
              <TabsTrigger value="snowball" className="gap-1.5">
                <Snowflake className="size-4" /> {t("payoff.snowball")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-xs text-muted-foreground">
            {strategy === "avalanche"
              ? t("payoff.avalanche.short")
              : t("payoff.snowball.short")}
          </p>
        </div>

        {/* Extra €/mo */}
        <div className="grid gap-1.5">
          <Label htmlFor="extra" className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("payoff.extraLabel")}
          </Label>
          <Input
            id="extra"
            inputMode="decimal"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="0"
          />
        </div>

        {/* Lump sum */}
        <div className="grid gap-2 rounded-lg border p-3">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("payoff.lumpSum")}
            </Label>
            <p className="text-xs text-muted-foreground">{t("payoff.lumpSumHelp")}</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lump" className="text-xs">
              {t("payoff.lumpSumAmount")}
            </Label>
            <Input
              id="lump"
              inputMode="decimal"
              value={lumpAmount}
              onChange={(e) => setLumpAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          {activeDebts.length > 1 && (
            <div className="grid gap-1.5">
              <Label className="text-xs">{t("payoff.lumpSumDebt")}</Label>
              <Select value={lumpDebtId} onValueChange={setLumpDebtId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeDebts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {lumpNum > 0 && (
            <RadioGroup
              value={lumpMode}
              onValueChange={(v) => setLumpMode(v as RecomputeMode)}
              className="gap-1.5"
            >
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="shorten_term" id="lm-shorten" className="mt-0.5" />
                <span>
                  <span className="font-medium">{t("payoff.lumpSumMode.shorten")}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("payoff.lumpSumMode.shorten.hint")}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="reduce_installment" id="lm-reduce" className="mt-0.5" />
                <span>
                  <span className="font-medium">{t("payoff.lumpSumMode.reduce")}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("payoff.lumpSumMode.reduce.hint")}
                  </span>
                </span>
              </label>
            </RadioGroup>
          )}
        </div>

        {/* Results */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3.5" /> {t("payoff.currentPath")}
              </div>
              <div className="font-medium tabular-nums">
                {formatDuration(baseline.months, t)}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("payoff.interestTotal", { amount: money(baseline.totalInterest) })}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-xs text-primary">
                <Trophy className="size-3.5" /> {t("payoff.withExtra")}
              </div>
              <div className="font-medium tabular-nums text-primary">
                {formatDuration(withExtra.months, t)}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("payoff.interestTotal", { amount: money(withExtra.totalInterest) })}
              </div>
            </div>
          </div>

          <div className="space-y-1.5" aria-hidden>
            <div className="h-2 rounded bg-muted-foreground/20 relative">
              <div className="absolute inset-y-0 left-0 rounded bg-muted-foreground/50 w-full" />
            </div>
            <div className="h-2 rounded bg-muted-foreground/20 relative">
              <div
                className="absolute inset-y-0 left-0 rounded bg-primary transition-all"
                style={{ width: `${relPct}%` }}
              />
            </div>
          </div>

          {(extraNum > 0 || lumpNum > 0) && (monthsSaved > 0 || interestSaved > 0.5) ? (
            <p className="text-sm">
              {t("payoff.savings", {
                time:
                  yearsSaved > 0
                    ? t("payoff.yearsMonths", { years: yearsSaved, months: remMonths })
                    : t("payoff.monthsCount", { count: monthsSaved }),
                money: money(interestSaved),
              })}
            </p>
          ) : extraNum > 0 || lumpNum > 0 ? (
            <p className="text-sm text-muted-foreground">{t("payoff.noSavings")}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("payoff.tryExtra")}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {t("payoff.payoffOn", { date: fmtDate(withExtra.payoffDate) })}
          </p>
        </div>

        {/* Recommended order (with manual override) */}
        {effectiveOrder.length > 1 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("payoff.orderTitle")}
              </Label>
              {isCustom && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setCustomOrder(null)}
                >
                  <RotateCcw className="size-3.5" /> {t("payoff.resetOrder")}
                </Button>
              )}
            </div>
            <ol className="space-y-1.5">
              {effectiveOrder.map((d, i) => {
                const s = debtLiveSchedule(d);
                return (
                  <li
                    key={d.id}
                    className="flex items-center gap-2 rounded border p-2 text-sm"
                  >
                    <Badge variant={i === 0 ? "default" : "outline"} className="shrink-0">
                      {i + 1}
                    </Badge>
                    <span className="truncate flex-1">{d.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {strategy === "avalanche" && d.taeg_pct != null && !isCustom
                        ? `${Number(d.taeg_pct).toFixed(2)}%`
                        : money(s.remaining)}
                    </span>
                    <div className="flex gap-0.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={i === 0}
                        aria-label={t("payoff.moveUp")}
                        onClick={() => moveOrder(i, -1)}
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={i === effectiveOrder.length - 1}
                        aria-label={t("payoff.moveDown")}
                        onClick={() => moveOrder(i, 1)}
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="text-xs text-muted-foreground">
              {isCustom ? t("payoff.orderCustomHint") : t("payoff.orderHint")}
            </p>
          </div>
        )}

        {/* Per-loan progress */}
        {withExtra.perLoan.length > 1 && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("payoff.perLoanTitle")}
            </Label>
            <ul className="space-y-2">
              {withExtra.perLoan
                .slice()
                .sort((a, b) => (a.paidOffMonth ?? 9999) - (b.paidOffMonth ?? 9999))
                .map((l) => {
                  const pct =
                    withExtra.months > 0 && l.paidOffMonth != null
                      ? (l.paidOffMonth / withExtra.months) * 100
                      : 100;
                  return (
                    <li key={l.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate">{l.label}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {l.paidOffMonth != null
                            ? formatDuration(l.paidOffMonth, t)
                            : t("payoff.beyondHorizon")}
                        </span>
                      </div>
                      <Progress value={pct} />
                    </li>
                  );
                })}
            </ul>
          </div>
        )}

        {/* Learn */}
        <Accordion type="single" collapsible>
          <AccordionItem value="learn" className="border rounded-md px-3">
            <AccordionTrigger className="text-sm py-2">
              {t("payoff.learn.title")}
            </AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm text-muted-foreground">
              <div>
                <p className="flex items-center gap-1.5 font-medium text-foreground">
                  <Mountain className="size-4" /> {t("payoff.avalanche")}
                </p>
                <p>{t("payoff.avalanche.long")}</p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 font-medium text-foreground">
                  <Snowflake className="size-4" /> {t("payoff.snowball")}
                </p>
                <p>{t("payoff.snowball.long")}</p>
              </div>
              <p className="text-xs italic">{t("payoff.learn.tip")}</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

function formatDuration(months: number, t: ReturnType<typeof useT>): string {
  if (months <= 0) return t("payoff.now");
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return t("payoff.monthsCount", { count: m });
  if (m === 0) return t("payoff.yearsCount", { count: y });
  return t("payoff.yearsMonths", { years: y, months: m });
}
