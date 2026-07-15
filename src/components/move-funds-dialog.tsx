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
import { Loader2 } from "lucide-react";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { depositToBucket, withdrawFromBucket, transferBetweenBuckets } from "@/lib/movements";

type BucketOption = { id: string; name: string };
type Action = "deposit" | "withdrawal" | "transfer";

export function MoveFundsDialog({
  householdId,
  buckets,
  bucketBalances,
  open,
  onOpenChange,
}: {
  householdId: string;
  buckets: BucketOption[];
  bucketBalances: Record<string, number>;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [action, setAction] = useState<Action>("deposit");
  const [bucket, setBucket] = useState<string>(buckets[0]?.id ?? "");
  const [toBucket, setToBucket] = useState<string>("");
  const [amountStr, setAmountStr] = useState("");
  const [reason, setReason] = useState("");

  const amount = Number(amountStr) || 0;
  const sourceBalance = bucketBalances[bucket] ?? 0;
  const needsSource = action === "withdrawal" || action === "transfer";
  const fundsShort = needsSource && amount > sourceBalance;
  const canSubmit =
    amount > 0 &&
    !!bucket &&
    !fundsShort &&
    (action !== "transfer" || (!!toBucket && toBucket !== bucket));

  const mut = useMutation({
    mutationFn: () => {
      const common = { householdId, amount, reason: reason.trim() || undefined };
      if (action === "deposit") return depositToBucket({ ...common, bucketId: bucket });
      if (action === "withdrawal") return withdrawFromBucket({ ...common, bucketId: bucket });
      return transferBetweenBuckets({ ...common, fromBucketId: bucket, toBucketId: toBucket });
    },
    onSuccess: () => {
      toast.success(t("move.toastMoved"));
      qc.invalidateQueries();
      onOpenChange(false);
      setAmountStr("");
      setReason("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("move.toastFailed")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("debt.moveFunds")}</DialogTitle>
          <DialogDescription>{t("move.desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("move.action")}</Label>
            <Select value={action} onValueChange={(v) => setAction(v as Action)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deposit">{t("move.add")}</SelectItem>
                <SelectItem value="withdrawal">{t("move.withdraw")}</SelectItem>
                <SelectItem value="transfer">{t("move.transfer")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              {action === "transfer" ? t("move.fromProject") : t("move.project")}
            </Label>
            <Select value={bucket} onValueChange={setBucket}>
              <SelectTrigger>
                <SelectValue placeholder={t("move.selectProject")} />
              </SelectTrigger>
              <SelectContent>
                {buckets.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {t("debt.projectOption", { name: b.name, balance: money(bucketBalances[b.id] ?? 0) })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {action === "transfer" && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t("move.toProject")}</Label>
              <Select value={toBucket} onValueChange={setToBucket}>
                <SelectTrigger>
                  <SelectValue placeholder={t("move.selectProject")} />
                </SelectTrigger>
                <SelectContent>
                  {buckets
                    .filter((b) => b.id !== bucket)
                    .map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
            {fundsShort && (
              <p className="text-xs text-destructive">
                {t("move.onlyAvailable", { amount: money(sourceBalance) })}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("move.reasonOptional")}</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("move.reasonPlaceholder")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("debt.cancel")}
          </Button>
          <Button disabled={!canSubmit || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? <Loader2 className="size-4 animate-spin" /> : null} {t("move.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
