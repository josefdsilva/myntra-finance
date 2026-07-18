import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowLeftRight, Wallet, HelpCircle, MessageSquare } from "lucide-react";
import { money, fmtDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { debtLiveSchedule, debtMonthlyRate, type Debt } from "@/lib/debt-schedule";
import { bucketBalancesFor, logScheduledDebtPayment, type AccountMovement } from "@/lib/movements";
import { OverpaymentDialog } from "@/components/overpayment-dialog";
import { MoveFundsDialog } from "@/components/move-funds-dialog";

type BucketRow = { id: string; name: string; initial_balance: number };

export function DebtsSection({ householdId }: { householdId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [moveOpen, setMoveOpen] = useState(false);
  const [payDebt, setPayDebt] = useState<Debt | null>(null);

  const { data } = useQuery({
    enabled: !!householdId,
    queryKey: ["debts-section", householdId],
    queryFn: async () => {
      const [{ data: debts }, { data: buckets }, { data: allocations }, { data: movements }] =
        await Promise.all([
          supabase.from("debts").select("*").eq("household_id", householdId).order("sort_order"),
          supabase
            .from("buckets")
            .select("id, name, initial_balance")
            .eq("household_id", householdId)
            .order("sort_order"),
          supabase.from("bucket_allocations").select("bucket_id, amount").eq("household_id", householdId),
          supabase.from("account_movements").select("*").eq("household_id", householdId),
        ]);
      return {
        debts: (debts ?? []) as Debt[],
        buckets: (buckets ?? []) as BucketRow[],
        allocations: (allocations ?? []) as Array<{ bucket_id: string; amount: number }>,
        movements: (movements ?? []) as AccountMovement[],
      };
    },
  });

  const debts = data?.debts ?? [];
  const buckets = data?.buckets ?? [];
  const balances = bucketBalancesFor(buckets, data?.allocations ?? [], data?.movements ?? []);
  const bucketOptions = buckets.map((b) => ({ id: b.id, name: b.name }));

  // Log the regular monthly payment for each active loan once per cycle, dated
  // the first day of the cycle. The RPC is idempotent per (debt, period), so this
  // is safe to run on every load and across shared-household members / devices.
  useEffect(() => {
    if (!data?.debts?.length) return;
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    // Pay each loan on the maturity date's day-of-month (clamped to the month, so
    // a due-day of 31 lands on the last day of a shorter month). Falls back to the
    // 1st when no maturity date is set.
    const paymentPeriod = (maturity: string | null): Date => {
      const day = maturity ? Number(maturity.slice(8, 10)) || 1 : 1;
      return new Date(now.getFullYear(), now.getMonth(), Math.min(day, daysInMonth));
    };
    const active = data.debts.filter(
      (d) => Number(d.monthly_amount) > 0 && !debtLiveSchedule(d).paidOff,
    );
    if (!active.length) return;
    let cancelled = false;
    Promise.allSettled(
      active.map((d) =>
        logScheduledDebtPayment({
          householdId,
          debtId: d.id,
          period: paymentPeriod(d.maturity_date),
          amount: Number(d.monthly_amount),
        }),
      ),
    ).then((results) => {
      if (cancelled) return;
      // Only refresh if a new entry was actually created (avoids a refetch loop).
      if (results.some((r) => r.status === "fulfilled" && r.value)) {
        qc.invalidateQueries({ queryKey: ["debts-section", householdId] });
        qc.invalidateQueries({ queryKey: ["alloc-bucket-movements", householdId] });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.debts, householdId]);

  if (!data) return null;
  if (debts.length === 0 && buckets.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle>{t("debt.sectionTitle")}</CardTitle>
          <CardDescription>{t("debt.sectionDesc")}</CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 whitespace-nowrap"
          disabled={buckets.length === 0}
          onClick={() => setMoveOpen(true)}
        >
          <ArrowLeftRight className="size-4" /> {t("debt.moveFunds")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
       <TooltipProvider delayDuration={80}>
        {debts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{t("debt.none")}</p>
        ) : (
          <ul className="space-y-4">
            {debts.map((debt) => {
              const s = debtLiveSchedule(debt);
              const start = Number(debt.starting_principal ?? debt.principal_remaining ?? 0);
              // What this loan costs right now, in plain money: this month's interest.
              const monthlyInterestNow =
                Math.round(s.remaining * debtMonthlyRate(debt) * 100) / 100;
              const payments = (data?.movements ?? [])
                .filter((m) => m.to_type === "debt" && m.to_id === debt.id)
                .sort((a, b) => String(b.period).localeCompare(String(a.period)))
                .slice(0, 3);
              return (
                <li key={debt.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Wallet className="size-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{debt.label}</span>
                      {debt.taeg_pct != null && (
                        <Badge variant="outline" className="text-[10px]">
                          {t("debt.apr", { pct: Number(debt.taeg_pct).toFixed(2) })}
                        </Badge>
                      )}
                    </div>
                    <Button size="sm" onClick={() => setPayDebt(debt)}>
                      {t("debt.makePayment")}
                    </Button>
                  </div>

                  <Progress value={s.progressPct} />

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{t("debt.leftOf", { amount: money(s.remaining), total: money(start) })}</span>
                    <span>{t("debt.perMonth", { amount: money(Number(debt.monthly_amount)) })}</span>
                    <span>
                      {s.paidOff
                        ? t("debt.paidOff")
                        : s.payoffDate
                          ? t("debt.payoffOn", { date: fmtDate(s.payoffDate) })
                          : "—"}
                    </span>
                    {!s.paidOff && s.totalInterestRemaining > 0 && (
                      <span>{t("debt.interestLeft", { amount: money(s.totalInterestRemaining) })}</span>
                    )}
                  </div>

                  {!s.paidOff && monthlyInterestNow > 0 && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      {t("debt.costsPerMonth", { amount: money(monthlyInterestNow) })}
                      <UiTooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground/70"
                            title={t("debt.costsHelp")}
                          >
                            <HelpCircle className="size-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-64 text-xs">
                          {t("debt.costsHelp")}
                        </TooltipContent>
                      </UiTooltip>
                    </p>
                  )}

                  {payments.length > 0 && (
                    <ul className="mt-1 space-y-0.5 border-t pt-2 text-xs text-muted-foreground">
                      {payments.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-2">
                          <span>
                            {fmtDate(m.period)} ·{" "}
                            {m.reason === "scheduled" ? t("debt.logScheduled") : t("debt.logExtra")}
                          </span>
                          <span className="tabular-nums">{money(Number(m.amount))}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {debts.length > 0 && (
          <div className="space-y-2 border-t pt-3 text-xs text-muted-foreground">
            <p>{t("debt.faster.note")}</p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() =>
                navigate({ to: "/analysis", search: { ask: t("debt.faster.askPrompt") } as never })
              }
            >
              <MessageSquare className="size-3.5" /> {t("debt.faster.ask")}
            </Button>
          </div>
        )}
       </TooltipProvider>
      </CardContent>

      {payDebt && (
        <OverpaymentDialog
          debt={payDebt}
          householdId={householdId}
          buckets={bucketOptions}
          bucketBalances={balances}
          open={!!payDebt}
          onOpenChange={(v) => !v && setPayDebt(null)}
        />
      )}
      <MoveFundsDialog
        householdId={householdId}
        buckets={bucketOptions}
        bucketBalances={balances}
        open={moveOpen}
        onOpenChange={setMoveOpen}
      />
    </Card>
  );
}
