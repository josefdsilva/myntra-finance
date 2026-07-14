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
        preview?.paidOff ? "Debt paid off in full." : `Paid ${money(amount)} toward ${debt.label}.`,
      );
      qc.invalidateQueries();
      onOpenChange(false);
      setAmountStr("");
      setReason("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Payment failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pay down {debt.label}</DialogTitle>
          <DialogDescription>
            An overpayment goes entirely to principal, then the schedule is recalculated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Amount</Label>
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
            <Label className="text-xs">Pay from</Label>
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
                <SelectItem value="cash">Cash / this cycle</SelectItem>
                {buckets.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({money(bucketBalances[b.id] ?? 0)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fundsShort && (
              <p className="text-xs text-destructive">Not enough balance in that project.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">After the overpayment</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as RecomputeMode)}>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="reduce_installment" /> Lower the monthly payment
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="shorten_term" /> Keep the payment, finish sooner
              </label>
            </RadioGroup>
          </div>

          {preview && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
              <Row label="Balance now" value={money(preview.balanceBefore)} />
              <Row label="After payment" value={money(preview.newPrincipal)} />
              {preview.paidOff ? (
                <p className="text-emerald-600 font-medium">This clears the debt in full.</p>
              ) : mode === "reduce_installment" ? (
                <Row
                  label="New monthly"
                  value={`${money(preview.newInstallment)} (was ${money(Number(debt.monthly_amount))})`}
                />
              ) : (
                <Row label="New payoff date" value={fmtDate(preview.newMaturity)} />
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Note (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. bonus" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Pay
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
