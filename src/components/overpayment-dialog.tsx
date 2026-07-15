import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { money, fmtDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { serviceDebt, type RecomputeMode } from "@/lib/movements";
import { previewOverpayment, type Debt } from "@/lib/debt-schedule";

type BucketOption = { id: string; name: string };

export function OverpaymentDialog({
  debt,
  householdId,
  buckets,
  bucketBalances,
  open,
  onOpenChange,
}: {
  debt: Debt;
  householdId: string;
  buckets: BucketOption[];
  bucketBalances: Record<string, number>;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [amountStr, setAmountStr] = useState("");
  const [source, setSource] = useState<"cash" | "bucket">("cash");
  const [sourceBucket, setSourceBucket] = useState<string>("");
  const [mode, setMode] = useState<RecomputeMode>("reduce_installment");
  const [reason, setReason] = useState("");

  const amount = Number(amountStr) || 0;
  const preview = amount > 0 ? previewOverpayment(debt, amount, mode) : null;

  const fundsShort =
    source === "bucket" && sourceBucket ? amount > (bucketBalances[sourceBucket] ?? 0) : false;
  const canSubmit =
    amount > 0 && !fundsShort && (source === "cash" || (source === "bucket" && !!sourceBucket));

  const mut = useMutation({
    mutationFn: () =>
      serviceDebt({
        householdId,
        debtId: debt.id,
        amount,
        source,
        sourceBucketId: source === "bucket" ? sourceBucket : undefined,
        newPrincipal: preview?.newPrincipal,
        newInstallment: preview?.newInstallment,
        newMaturity: preview?.newMaturity,
        recomputeMode: mode,
        reason: reason.trim() || undefined,
        asOf: new Date(),
      }),
    onSuccess: () => {
      toast.success(
        preview?.paidOff
          ? t("debt.toastPaidOff")
          : t("debt.toastPaid", { amount: money(amount), label: debt.label }),
      );
      qc.invalidateQueries();
      onOpenChange(false);
      setAmountStr("");
      setReason("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("debt.toastFailed")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("debt.payDownTitle", { label: debt.label })}</DialogTitle>
          <DialogDescription>{t("debt.overpayDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("debt.amount")}</Label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("debt.payFrom")}</Label>
            <Select
              value={source === "cash" ? "cash" : sourceBucket || "cash"}
              onValueChange={(v) => {
                if (v === "cash") {
                  setSource("cash");
                  setSourceBucket("");
                } else {
                  setSource("bucket");
                  setSourceBucket(v);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t("debt.cashOption")}</SelectItem>
                {buckets.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {t("debt.projectOption", { name: b.name, balance: money(bucketBalances[b.id] ?? 0) })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fundsShort && <p className="text-xs text-destructive">{t("debt.notEnough")}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("debt.afterOverpay")}</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as RecomputeMode)}>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="reduce_installment" /> {t("debt.reduceInstallment")}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="shorten_term" /> {t("debt.shortenTerm")}
              </label>
            </RadioGroup>
          </div>

          {preview && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
              <Row label={t("debt.balanceNow")} value={money(preview.balanceBefore)} />
              <Row label={t("debt.afterPayment")} value={money(preview.newPrincipal)} />
              {preview.paidOff ? (
                <p className="text-emerald-600 font-medium">{t("debt.clearsFull")}</p>
              ) : mode === "reduce_installment" ? (
                <Row
                  label={t("debt.newMonthly")}
                  value={t("debt.newMonthlyValue", {
                    value: money(preview.newInstallment),
                    old: money(Number(debt.monthly_amount)),
                  })}
                />
              ) : (
                <Row label={t("debt.newPayoff")} value={fmtDate(preview.newMaturity)} />
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">{t("debt.noteOptional")}</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("debt.notePlaceholder")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("debt.cancel")}
          </Button>
          <Button disabled={!canSubmit || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? <Loader2 className="size-4 animate-spin" /> : null} {t("debt.pay")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}
