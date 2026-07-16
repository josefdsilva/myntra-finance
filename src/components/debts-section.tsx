import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftRight, Wallet } from "lucide-react";
import { money, fmtDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { debtLiveSchedule, type Debt } from "@/lib/debt-schedule";
import { bucketBalancesFor, type AccountMovement } from "@/lib/movements";
import { OverpaymentDialog } from "@/components/overpayment-dialog";
import { MoveFundsDialog } from "@/components/move-funds-dialog";

type BucketRow = { id: string; name: string; initial_balance: number };

export function DebtsSection({ householdId }: { householdId: string }) {
  const t = useT();
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
        {debts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{t("debt.none")}</p>
        ) : (
          <ul className="space-y-4">
            {debts.map((debt) => {
              const s = debtLiveSchedule(debt);
              const start = Number(debt.starting_principal ?? debt.principal_remaining ?? 0);
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
                </li>
              );
            })}
          </ul>
        )}
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
