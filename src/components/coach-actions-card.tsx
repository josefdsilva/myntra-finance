import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  ACTION_HINTS,
  ACTION_KINDS,
  ACTION_LABELS,
  isRecurring,
  type ActionKind,
  type CoachAction,
} from "@/lib/coach-actions";
import {
  addExpense,
  upsertBucket,
  upsertDebt,
  upsertFixedExpense,
  upsertIncome,
  upsertVariableEstimate,
} from "@/lib/budget.functions";

const NO_CATEGORY = "__none__";

/**
 * The confirm step for chat-first actions. The coach proposes; the household
 * checks and edits; only then is anything written. Every row can be retyped,
 * re-categorised, switched to another kind, or dropped — so a wrong guess is
 * never a wrong record.
 */
export function CoachActionsCard({
  householdId,
  actions,
  categories,
  onCancel,
  onApplied,
}: {
  householdId: string;
  actions: CoachAction[];
  categories: string[];
  onCancel: () => void;
  onApplied: (summary: string) => void;
}) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<CoachAction[]>(actions);
  const [busy, setBusy] = useState(false);

  const expense = useServerFn(addExpense);
  const fixed = useServerFn(upsertFixedExpense);
  const variable = useServerFn(upsertVariableEstimate);
  const income = useServerFn(upsertIncome);
  const debt = useServerFn(upsertDebt);
  const bucket = useServerFn(upsertBucket);

  function patch(i: number, next: Partial<CoachAction>) {
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...next } : x)));
  }

  async function apply(row: CoachAction) {
    const hid = householdId;
    switch (row.kind) {
      case "expense":
      case "income_entry":
        await expense({
          data: {
            household_id: hid,
            amount: row.amount,
            category: row.category || "Other",
            merchant: row.label,
            occurred_at: row.occurred_at ?? undefined,
            source: "ai_memo",
            kind: row.kind === "expense" ? "expense" : "income",
          },
        });
        return;
      case "fixed":
        await fixed({
          data: {
            household_id: hid,
            label: row.label,
            category: row.category ?? null,
            native_amount: row.amount,
            cadence: "monthly",
          },
        });
        return;
      case "variable":
        await variable({
          data: {
            household_id: hid,
            label: row.label,
            category: row.category ?? null,
            monthly_amount: row.amount,
          },
        });
        return;
      case "income":
        await income({
          data: {
            household_id: hid,
            label: row.label,
            native_amount: row.amount,
            cadence: "monthly",
            type: "other",
          },
        });
        return;
      case "debt":
        await debt({
          data: {
            household_id: hid,
            label: row.label,
            kind: "other",
            monthly_amount: row.amount,
            taeg_pct: row.taeg_pct ?? null,
          },
        });
        return;
      case "project":
        await bucket({
          data: {
            household_id: hid,
            name: row.label,
            target_type: "fixed_monthly",
            target_value: row.amount,
            kind: "savings",
          },
        });
        return;
    }
  }

  async function confirm() {
    if (busy || !rows.length) return;
    setBusy(true);
    let done = 0;
    try {
      for (const row of rows) {
        if (!row.label.trim() || row.amount <= 0) continue;
        await apply(row);
        done++;
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["expenses"] }),
        qc.invalidateQueries({ queryKey: ["fixed"] }),
        qc.invalidateQueries({ queryKey: ["variables"] }),
        qc.invalidateQueries({ queryKey: ["incomes"] }),
        qc.invalidateQueries({ queryKey: ["debts"] }),
        qc.invalidateQueries({ queryKey: ["buckets"] }),
        qc.invalidateQueries({ queryKey: ["cycle-metrics"] }),
      ]);
      onApplied(
        done === 1 ? "Saved 1 item. It's in your numbers now." : `Saved ${done} items. They're in your numbers now.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="mb-2 text-xs text-muted-foreground">
        Here's what I understood. Change anything, then confirm — nothing is saved until you do.
      </p>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="rounded-lg border p-2.5">
            <div className="flex items-center gap-2">
              <Select
                value={r.kind}
                onValueChange={(v) =>
                  patch(i, {
                    kind: v as ActionKind,
                    occurred_at: isRecurring(v as ActionKind) ? null : r.occurred_at,
                  })
                }
              >
                <SelectTrigger className="h-8 flex-1" aria-label="Type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {ACTION_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove item"
                onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Input
                className="h-8 flex-1"
                aria-label="Name"
                value={r.label}
                onChange={(e) => patch(i, { label: e.target.value })}
              />
              <Input
                className="h-8 w-24"
                type="number"
                step="0.01"
                aria-label="Amount"
                value={r.amount}
                onChange={(e) => patch(i, { amount: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="mt-2 flex items-center gap-2">
              {(r.kind === "expense" || r.kind === "fixed" || r.kind === "variable") &&
                categories.length > 0 && (
                  <Select
                    value={r.category ?? NO_CATEGORY}
                    onValueChange={(v) => patch(i, { category: v === NO_CATEGORY ? null : v })}
                  >
                    <SelectTrigger className="h-8 flex-1" aria-label="Category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              {r.kind === "debt" && (
                <Input
                  className="h-8 w-28"
                  type="number"
                  step="0.01"
                  placeholder="Rate %"
                  aria-label="Interest rate percent"
                  value={r.taeg_pct ?? ""}
                  onChange={(e) =>
                    patch(i, {
                      taeg_pct: e.target.value === "" ? null : parseFloat(e.target.value) || 0,
                    })
                  }
                />
              )}
              {!isRecurring(r.kind) && (
                <Input
                  className="h-8 w-36"
                  type="date"
                  aria-label="Date"
                  value={r.occurred_at ?? ""}
                  onChange={(e) => patch(i, { occurred_at: e.target.value || null })}
                />
              )}
            </div>

            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {ACTION_HINTS[r.kind]}
              {isRecurring(r.kind) ? " · per month" : ""}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={confirm} disabled={busy || !rows.length}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Confirm
          &amp; save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
