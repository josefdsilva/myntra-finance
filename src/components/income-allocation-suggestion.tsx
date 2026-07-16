import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { confirmBucketAllocation } from "@/lib/bucket-allocations.functions";
import { money } from "@/lib/format";
import { Loader2, PiggyBank, Wallet, CreditCard, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

type Bucket = {
  id: string;
  name: string;
  target_type: "pct_surplus" | "fixed_monthly" | "fixed_yearly" | "goal_by_date";
  target_value: number;
  target_deadline: string | null;
  color: string | null;
  kind: "savings" | "emergency" | "investment" | null;
};

type Debt = {
  id: string;
  label: string;
  monthly_amount: number;
  taeg_pct: number | null;
  principal_remaining: number | null;
};

/**
 * After the user records money-received (salary or one-off), suggest a distribution:
 * - Pro-rata top up each bucket's monthly target (up to what's still missing this month)
 * - Optional extra payment to highest-TAEG debt
 * - Remainder stays in the bank account
 * User can tweak each row and confirm — bucket rows use `mode: "add"` so they stack
 * on top of prior confirmations for the current period.
 */
export function IncomeAllocationSuggestion({
  householdId,
  amount,
  open,
  onOpenChange,
}: {
  householdId: string;
  amount: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const confirmFn = useServerFn(confirmBucketAllocation);
  const t = useT();

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const { data, isLoading } = useQuery({
    enabled: open && !!householdId,
    queryKey: ["income-suggestion", householdId, period],
    queryFn: async () => {
      const [buckets, allocs, debts, hh] = await Promise.all([
        supabase
          .from("buckets")
          .select("id, name, target_type, target_value, target_deadline, color, kind")
          .eq("household_id", householdId)
          .order("sort_order"),
        supabase
          .from("bucket_allocations")
          .select("bucket_id, amount")
          .eq("household_id", householdId)
          .eq("period", period),
        supabase
          .from("debts")
          .select("id, label, monthly_amount, taeg_pct, principal_remaining")
          .eq("household_id", householdId),
        supabase.from("households").select("baseline_budget").eq("id", householdId).maybeSingle(),
      ]);
      return {
        buckets: (buckets.data ?? []) as Bucket[],
        allocations: (allocs.data ?? []) as { bucket_id: string; amount: number }[],
        debts: (debts.data ?? []) as Debt[],
        baseline: Number(hh.data?.baseline_budget ?? 0),
      };
    },
  });

  // Estimate a monthly target per bucket (matches the allocations page math)
  const computeMonthly = (b: Bucket, surplus: number): number => {
    const v = Number(b.target_value);
    if (b.target_type === "pct_surplus") return (surplus * v) / 100;
    if (b.target_type === "fixed_monthly") return v;
    if (b.target_type === "fixed_yearly") return v / 12;
    if (b.target_type === "goal_by_date" && b.target_deadline) {
      const target = new Date(b.target_deadline);
      const months = Math.max(
        1,
        (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()) + 1,
      );
      return v / months;
    }
    return v;
  };

  // Local state: editable amounts per bucket + extra debt payment + "keep in account"
  const [bucketAmts, setBucketAmts] = useState<Record<string, string>>({});
  const [debtId, setDebtId] = useState<string | null>(null);
  const [debtAmt, setDebtAmt] = useState("0");
  const [saving, setSaving] = useState(false);

  // Seed suggestions when data arrives / dialog opens
  useEffect(() => {
    if (!data || !open) return;
    const surplus = Math.max(0, amount - 0); // caller says this is a top-up income
    const missingPerBucket = data.buckets.map((b) => {
      const monthly = computeMonthly(b, surplus);
      const alreadyMoved = data.allocations
        .filter((a) => a.bucket_id === b.id)
        .reduce((s, a) => s + Number(a.amount), 0);
      const missing = Math.max(0, monthly - alreadyMoved);
      return { b, missing };
    });
    const totalMissing = missingPerBucket.reduce((s, x) => s + x.missing, 0);
    // If buckets need topping up, allocate up to that total from this income.
    const towardsBuckets = Math.min(amount, totalMissing);
    const seededBuckets: Record<string, string> = {};
    for (const { b, missing } of missingPerBucket) {
      const share =
        totalMissing > 0 ? Math.round((missing / totalMissing) * towardsBuckets * 100) / 100 : 0;
      seededBuckets[b.id] = share > 0 ? share.toFixed(2) : "0.00";
    }
    setBucketAmts(seededBuckets);

    // Debt: pick highest TAEG debt with principal remaining
    const eligibleDebts = [...data.debts]
      .filter((d) => (d.principal_remaining ?? 0) > 0)
      .sort((a, b) => (b.taeg_pct ?? 0) - (a.taeg_pct ?? 0));
    const remainderAfterBuckets = Math.max(0, amount - towardsBuckets);
    if (eligibleDebts.length > 0 && (eligibleDebts[0].taeg_pct ?? 0) >= 3) {
      // Suggest 30% of the remainder toward high-TAEG debt
      const debtSuggested = Math.min(
        remainderAfterBuckets,
        Math.round(remainderAfterBuckets * 0.3 * 100) / 100,
      );
      setDebtId(eligibleDebts[0].id);
      setDebtAmt(debtSuggested > 0 ? debtSuggested.toFixed(2) : "0.00");
    } else {
      setDebtId(eligibleDebts[0]?.id ?? null);
      setDebtAmt("0.00");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, open, amount]);

  const parsedBuckets = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(bucketAmts).map(([k, v]) => [
          k,
          Math.max(0, parseFloat(v.replace(",", ".")) || 0),
        ]),
      ),
    [bucketAmts],
  );
  const parsedDebt = Math.max(0, parseFloat(debtAmt.replace(",", ".")) || 0);
  const bucketsTotal = Object.values(parsedBuckets).reduce((s, n) => s + n, 0);
  const distributedTotal = bucketsTotal + parsedDebt;
  const keepInAccount = amount - distributedTotal;
  const overspend = keepInAccount < -0.005;

  async function confirmAll() {
    if (overspend) {
      toast.error(t("incomeSuggestion.overspendError", { amount: money(-keepInAccount) }));
      return;
    }
    setSaving(true);
    try {
      const bucketPromises = Object.entries(parsedBuckets)
        .filter(([, amt]) => amt > 0)
        .map(([bucket_id, amt]) =>
          confirmFn({
            data: {
              household_id: householdId,
              bucket_id,
              period,
              amount: amt,
              note: t("incomeSuggestion.noteFromReceived"),
              mode: "add",
            },
          }),
        );
      await Promise.all(bucketPromises);
      qc.invalidateQueries({ queryKey: ["bucket-allocations", householdId, period] });
      qc.invalidateQueries({ queryKey: ["bucket-allocations-history", householdId] });
      qc.invalidateQueries({ queryKey: ["bucket-allocations-totals", householdId] });
      qc.invalidateQueries({
        queryKey: ["bucket-allocations-ytd", householdId, new Date().getFullYear()],
      });
      const parts: string[] = [];
      if (bucketsTotal > 0)
        parts.push(t("incomeSuggestion.partBuckets", { amount: money(bucketsTotal) }));
      if (parsedDebt > 0) parts.push(t("incomeSuggestion.partDebt", { amount: money(parsedDebt) }));
      if (keepInAccount > 0.005)
        parts.push(t("incomeSuggestion.partKeep", { amount: money(keepInAccount) }));
      toast.success(
        parts.length
          ? t("incomeSuggestion.doneToast", { parts: parts.join(", ") })
          : t("incomeSuggestion.noChangeToast"),
      );
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("incomeSuggestion.failedToast"));
    } finally {
      setSaving(false);
    }
  }

  const chosenDebt = data?.debts.find((d) => d.id === debtId) ?? null;

  // Short badge for the projects that matter to the save-vs-invest priority.
  const kindBadge = (k: Bucket["kind"]): string | null =>
    k === "emergency"
      ? t("buckets.kindEmergency")
      : k === "investment"
        ? t("buckets.kindInvestment")
        : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            {t("incomeSuggestion.title", { amount: money(amount) })}
          </DialogTitle>
          <DialogDescription>{t("incomeSuggestion.description")}</DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                {t("incomeSuggestion.priorityTitle")}
              </p>
              <p className="mt-1">{t("incomeSuggestion.priorityBody")}</p>
            </div>
            {data.buckets.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-md bg-muted/40 p-3">
                {t("incomeSuggestion.noBuckets")}
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <PiggyBank className="size-3.5" /> {t("incomeSuggestion.moveToBuckets")}
                </p>
                {data.buckets.map((b) => (
                  <div key={b.id} className="flex items-center gap-3">
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ background: b.color ?? "var(--primary)" }}
                    />
                    <span className="text-sm flex-1 truncate">{b.name}</span>
                    {kindBadge(b.kind) && (
                      <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-muted text-muted-foreground shrink-0">
                        {kindBadge(b.kind)}
                      </span>
                    )}
                    <div className="w-28">
                      <Input
                        inputMode="decimal"
                        value={bucketAmts[b.id] ?? "0.00"}
                        onChange={(e) =>
                          setBucketAmts((prev) => ({ ...prev, [b.id]: e.target.value }))
                        }
                        className="h-8 text-right tabular-nums"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {chosenDebt && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CreditCard className="size-3.5" /> {t("incomeSuggestion.extraDebtPayment")}
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-sm flex-1 truncate">
                    {chosenDebt.label}
                    {chosenDebt.taeg_pct != null && (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        {t("incomeSuggestion.taeg", { pct: chosenDebt.taeg_pct })}
                      </span>
                    )}
                  </span>
                  <div className="w-28">
                    <Input
                      inputMode="decimal"
                      value={debtAmt}
                      onChange={(e) => setDebtAmt(e.target.value)}
                      className="h-8 text-right tabular-nums"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t("incomeSuggestion.debtNote")}</p>
              </div>
            )}

            <div className="rounded-md border p-3 space-y-1.5 text-sm bg-muted/30">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("incomeSuggestion.distributed")}</span>
                <span className="tabular-nums font-medium">{money(distributedTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Wallet className="size-3.5" /> {t("incomeSuggestion.keepInAccount")}
                </span>
                <span
                  className={`tabular-nums font-medium ${overspend ? "text-destructive" : "text-emerald-600"}`}
                >
                  {money(keepInAccount)}
                </span>
              </div>
              {overspend && (
                <p className="text-xs text-destructive">{t("incomeSuggestion.overspendWarning")}</p>
              )}
              <div className="pt-1">
                <Label htmlFor="income-received-total" className="sr-only">
                  {t("incomeSuggestion.received")}
                </Label>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t("incomeSuggestion.received")}</span>
                  <span className="tabular-nums">{money(amount)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("incomeSuggestion.skip")}
          </Button>
          <Button onClick={confirmAll} disabled={saving || isLoading || overspend}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("incomeSuggestion.applyDistribution")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
