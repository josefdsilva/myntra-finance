import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  TrendingUp,
  TrendingDown,
  Check,
  Paperclip,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { InvoiceAttachments } from "@/components/invoice-attachments";
import { money, fmtDate } from "@/lib/format";
import {
  perCycleFromMonthly,
  reconcileOccurrences,
  type Cycle,
  type Cadence,
} from "@/lib/cadence";
import { cycleFor, cycleConfigForSpace } from "@/lib/cycle";
import {
  markIncomeReceived,
  markFixedExpensePaid,
  unmarkFixedExpensePaid,
  deleteExpense,
} from "@/lib/budget.functions";
import { invalidateHouseholdData } from "@/lib/household-queries";
import { planAppliesToMonth, monthKey, type Plan } from "@/lib/plan";
import { useT } from "@/lib/i18n";

type Line = {
  id: string;
  label: string;
  cadence: Cadence;
  native_amount: number | null;
  monthly_amount: number;
};
type Mark = { id: string; amount: number; occurred_at: string };
type Dir = "in" | "out";

type DialogState = {
  dir: Dir;
  lineId: string;
  label: string;
  occStartISO: string;
  amount: string;
  targetId: string | null; // settlement id (out) or expense id (in) once created
};

/**
 * Committed lines expected this cycle: recurring income and fixed costs.
 *
 * Reconciliation happens at each line's OWN cadence, not the reporting cycle: a
 * monthly salary inside a quarterly cycle shows three pay runs, each with its
 * own real amount and its own invoice. The definition amount stays the estimate
 * that feeds the baseline/forecast; these occurrences carry the actuals.
 */
export function CommittedThisCycle({
  householdId,
  cycle,
  isBusiness,
}: {
  householdId: string;
  cycle: Cycle;
  isBusiness: boolean;
}) {
  const t = useT();
  const qc = useQueryClient();
  const markIn = useServerFn(markIncomeReceived);
  const markOut = useServerFn(markFixedExpensePaid);
  const unmarkOut = useServerFn(unmarkFixedExpensePaid);
  const delExpense = useServerFn(deleteExpense);
  const suffix = t(`cadence.short.${cycle}`);

  const { data, refetch } = useQuery({
    queryKey: ["cycle-committed", householdId],
    queryFn: async () => {
      const [fx, inc, db, space, salaries] = await Promise.all([
        supabase
          .from("fixed_expenses")
          .select("id, label, cadence, native_amount, monthly_amount")
          .eq("household_id", householdId)
          .order("created_at"),
        supabase
          .from("incomes")
          .select("id, label, cadence, native_amount, monthly_amount")
          .eq("household_id", householdId)
          .order("created_at"),
        supabase
          .from("debts")
          .select("id, label, monthly_amount")
          .eq("household_id", householdId)
          .order("created_at"),
        supabase
          .from("households")
          .select("kind, cycle, cycle_mode, cycle_anchor_date")
          .eq("id", householdId)
          .maybeSingle(),
        supabase
          .from("expenses")
          .select("occurred_at")
          .eq("household_id", householdId)
          .eq("kind", "income")
          .eq("is_salary", true)
          .order("occurred_at", { ascending: false })
          .limit(12),
      ]);
      const bounds = cycleFor(
        cycleConfigForSpace(space.data),
        (salaries.data ?? []).map((r) => r.occurred_at as string),
      );

      // Income receipts this cycle, grouped by income (each is one pay run).
      const { data: receipts } = await supabase
        .from("expenses")
        .select("id, income_id, amount, occurred_at")
        .eq("household_id", householdId)
        .eq("kind", "income")
        .not("income_id", "is", null)
        .gte("occurred_at", bounds.start.toISOString())
        .lt("occurred_at", bounds.end.toISOString());
      const receiptsByIncome: Record<string, Mark[]> = {};
      for (const r of receipts ?? []) {
        const k = r.income_id as string;
        (receiptsByIncome[k] ??= []).push({
          id: r.id as string,
          amount: Number(r.amount),
          occurred_at: r.occurred_at as string,
        });
      }

      // Fixed-cost settlements this cycle, grouped by cost (businesses only).
      const settlementsByFixed: Record<string, Mark[]> = {};
      if (isBusiness) {
        const { data: settlements } = await supabase
          .from("fixed_expense_settlements")
          .select("id, fixed_expense_id, amount, occurred_at")
          .eq("household_id", householdId)
          .gte("occurred_at", bounds.start.toISOString())
          .lt("occurred_at", bounds.end.toISOString());
        for (const s of settlements ?? []) {
          const k = s.fixed_expense_id as string;
          (settlementsByFixed[k] ??= []).push({
            id: s.id as string,
            amount: Number(s.amount),
            occurred_at: s.occurred_at as string,
          });
        }
      }

      // Which receipts/settlements already have an invoice (for the "missing
      // proof" flag businesses care about).
      const { data: invs } = await supabase
        .from("invoices")
        .select("expense_id, settlement_id")
        .eq("household_id", householdId);
      const invExpenses = new Set<string>();
      const invSettlements = new Set<string>();
      for (const i of invs ?? []) {
        if (i.expense_id) invExpenses.add(i.expense_id as string);
        if (i.settlement_id) invSettlements.add(i.settlement_id as string);
      }

      return {
        fixed: (fx.data ?? []) as Line[],
        incomes: (inc.data ?? []) as Line[],
        debts: (db.data ?? []) as Array<{ id: string; label: string; monthly_amount: number }>,
        start: bounds.start,
        end: bounds.end,
        receiptsByIncome,
        settlementsByFixed,
        invExpenses,
        invSettlements,
      };
    },
  });

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [saving, setSaving] = useState(false);

  const fixed = data?.fixed ?? [];
  const incomes = data?.incomes ?? [];
  const debts = data?.debts ?? [];

  function openMark(dir: Dir, line: Line, occStart: Date, expected: number) {
    setDialog({
      dir,
      lineId: line.id,
      label: line.label,
      occStartISO: occStart.toISOString(),
      amount: expected.toFixed(2),
      targetId: null,
    });
  }
  function openAttach(dir: Dir, label: string, targetId: string) {
    setDialog({ dir, lineId: "", label, occStartISO: "", amount: "", targetId });
  }

  async function confirmMark() {
    if (!dialog) return;
    const amount = Number(dialog.amount);
    if (!(amount > 0)) {
      toast.error(dialog.dir === "in" ? t("ledger.recordFailed") : t("ledger.payFailed"));
      return;
    }
    setSaving(true);
    try {
      let id: string | undefined;
      if (dialog.dir === "in") {
        const row = (await markIn({
          data: {
            household_id: householdId,
            income_id: dialog.lineId,
            amount,
            occurred_at: dialog.occStartISO,
          },
        })) as { id: string } | null;
        id = row?.id;
        invalidateHouseholdData(qc);
      } else {
        const row = (await markOut({
          data: {
            household_id: householdId,
            fixed_expense_id: dialog.lineId,
            amount,
            occurred_at: dialog.occStartISO,
          },
        })) as { id: string } | null;
        id = row?.id;
      }
      toast.success(dialog.dir === "in" ? t("ledger.recordedToast") : t("ledger.paidToast"));
      await refetch();
      if (id) setDialog({ ...dialog, targetId: id });
      else setDialog(null);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : dialog.dir === "in"
            ? t("ledger.recordFailed")
            : t("ledger.payFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function undo(dir: Dir, markId: string) {
    try {
      if (dir === "in") {
        await delExpense({ data: { id: markId } });
        invalidateHouseholdData(qc);
      } else {
        await unmarkOut({ data: { settlement_id: markId } });
      }
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("ledger.payFailed"));
    }
  }

  if (!fixed.length && !incomes.length && !debts.length) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("ledger.committedTitle")}</CardTitle>
          <CardDescription>{t("ledger.committedDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {incomes.length > 0 && data && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                {t(isBusiness ? "cashflow.inBiz" : "cashflow.in")}
              </p>
              <ul className="divide-y">
                {incomes.map((line) => (
                  <ReconLine
                    key={line.id}
                    dir="in"
                    line={line}
                    cycle={cycle}
                    cycleStart={data.start}
                    cycleEnd={data.end}
                    marks={data.receiptsByIncome[line.id] ?? []}
                    withInvoice={data.invExpenses}
                    canMark
                    isBusiness={isBusiness}
                    onMark={openMark}
                    onAttach={openAttach}
                    onUndo={undo}
                  />
                ))}
              </ul>
            </div>
          )}

          {fixed.length > 0 && data && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                {t("cashflow.fixed")}
              </p>
              <ul className="divide-y">
                {fixed.map((line) =>
                  isBusiness ? (
                    <ReconLine
                      key={line.id}
                      dir="out"
                      line={line}
                      cycle={cycle}
                      cycleStart={data.start}
                      cycleEnd={data.end}
                      marks={data.settlementsByFixed[line.id] ?? []}
                      withInvoice={data.invSettlements}
                      canMark
                      isBusiness={isBusiness}
                      onMark={openMark}
                      onAttach={openAttach}
                      onUndo={undo}
                    />
                  ) : (
                    <li
                      key={line.id}
                      className="flex items-center justify-between gap-2 py-1.5 text-sm"
                    >
                      <span className="min-w-0 truncate">{line.label}</span>
                      <span className="shrink-0 tabular-nums">
                        −{money(perCycleFromMonthly(Number(line.monthly_amount), cycle))}
                        {suffix}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}

          {debts.length > 0 && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                {t("cashflow.debt")}
              </p>
              <ul className="divide-y">
                {debts.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <span className="min-w-0 truncate">{r.label}</span>
                    <span className="shrink-0 tabular-nums">
                      −{money(perCycleFromMonthly(Number(r.monthly_amount), cycle))}
                      {suffix}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.dir === "in" ? t("ledger.markReceived") : t("ledger.markPaid")} ·{" "}
              {dialog?.label}
            </DialogTitle>
          </DialogHeader>
          {dialog && !dialog.targetId ? (
            <div className="space-y-3">
              <div>
                <Label>{dialog.dir === "in" ? t("ledger.amountReceived") : t("ledger.amountPaid")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={dialog.amount}
                  onChange={(e) => setDialog({ ...dialog, amount: e.target.value })}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={confirmMark} disabled={saving}>
                  {dialog.dir === "in" ? t("ledger.markReceived") : t("ledger.markPaid")}
                </Button>
              </DialogFooter>
            </div>
          ) : dialog ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("inv.attachOptional")}</p>
              <InvoiceAttachments
                householdId={householdId}
                expenseId={dialog.dir === "in" ? dialog.targetId! : undefined}
                settlementId={dialog.dir === "out" ? dialog.targetId! : undefined}
                isBusiness={isBusiness}
              />
              <DialogFooter>
                <Button onClick={() => setDialog(null)}>{t("ledger.done")}</Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** One recurring line, reconciled per its own cadence within the cycle. */
function ReconLine({
  dir,
  line,
  cycle,
  cycleStart,
  cycleEnd,
  marks,
  withInvoice,
  canMark,
  isBusiness,
  onMark,
  onAttach,
  onUndo,
}: {
  dir: Dir;
  line: Line;
  cycle: Cycle;
  cycleStart: Date;
  cycleEnd: Date;
  marks: Mark[];
  withInvoice: Set<string>;
  canMark: boolean;
  isBusiness: boolean;
  onMark: (dir: Dir, line: Line, occStart: Date, expected: number) => void;
  onAttach: (dir: Dir, label: string, targetId: string) => void;
  onUndo: (dir: Dir, markId: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const sign = dir === "in" ? "+" : "−";
  const amountClass = dir === "in" ? "text-primary" : "";

  const occ = reconcileOccurrences(
    line.cadence,
    Number(line.native_amount ?? line.monthly_amount),
    Number(line.monthly_amount),
    cycle,
    cycleStart,
    cycleEnd,
  );
  // Match each occurrence to a settlement/receipt that fell inside its window.
  const used = new Set<string>();
  const rows = occ.map((o) => {
    const m =
      marks.find((mk) => {
        if (used.has(mk.id)) return false;
        const at = new Date(mk.occurred_at).getTime();
        return at >= o.start.getTime() && at < o.end.getTime();
      }) ?? null;
    if (m) used.add(m.id);
    return { ...o, mark: m };
  });
  const total = rows.length;
  const paidCount = rows.filter((r) => r.mark).length;
  const expectedSum = rows.reduce((s, r) => s + r.expected, 0);

  function markCell(r: { start: Date; expected: number; mark: Mark | null }) {
    if (r.mark) {
      const missing = isBusiness && !withInvoice.has(r.mark.id);
      return (
        <span className={`flex shrink-0 items-center gap-1.5 tabular-nums ${amountClass}`}>
          <Check className="size-3.5 text-emerald-600" />
          {sign}
          {money(r.mark.amount)}
          {missing && <AlertTriangle className="size-3.5 text-destructive" />}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5"
            onClick={() => onAttach(dir, line.label, r.mark!.id)}
          >
            <Paperclip className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-xs"
            onClick={() => onUndo(dir, r.mark!.id)}
          >
            {t("ledger.undo")}
          </Button>
        </span>
      );
    }
    return (
      <span className="flex shrink-0 items-center gap-2">
        <span className="tabular-nums text-muted-foreground">
          {sign}
          {money(r.expected)}
        </span>
        {canMark && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => onMark(dir, line, r.start, r.expected)}
          >
            {dir === "in" ? t("ledger.markReceived") : t("ledger.markPaid")}
          </Button>
        )}
      </span>
    );
  }

  // A single occurrence renders as one flat row (no expansion needed).
  if (total === 1) {
    return (
      <li className="flex items-center justify-between gap-2 py-1.5 text-sm">
        <span className="min-w-0 truncate">{line.label}</span>
        {markCell(rows[0])}
      </li>
    );
  }

  return (
    <li className="py-1.5 text-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {open ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{line.label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 tabular-nums text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            {paidCount}/{total}
          </Badge>
          {sign}
          {money(expectedSum)}
        </span>
      </button>
      {open && (
        <ul className="mt-1 space-y-1 pl-5">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{fmtDate(r.start)}</span>
              {markCell(r)}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * One-off (and repeating) plans that land in the current cycle. Open ones show
 * their expected amount; resolved ones show the actual with an over/under badge.
 * Reconciling (mark paid/received) happens on the Planned tab / Plan page.
 */
export function PlannedThisCycle({ householdId }: { householdId: string }) {
  const t = useT();
  const ym = monthKey(new Date());
  const { data: plans = [] } = useQuery({
    queryKey: ["cycle-plans", householdId, ym],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("*").eq("household_id", householdId);
      return (data ?? []) as Plan[];
    },
  });

  const items = plans.filter(
    (p) =>
      (!p.done && planAppliesToMonth(p, ym)) || (p.done && String(p.month).slice(0, 7) === ym),
  );
  if (!items.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("ledger.plannedTitle")}</CardTitle>
        <CardDescription>{t("ledger.plannedDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {items.map((p) => {
            const expected = Math.abs(Number(p.amount) || 0);
            const done = !!p.done;
            const actual = Number(p.actual_amount ?? 0);
            const magnitude = Math.abs(expected - actual);
            const favorable = p.direction === "income" ? actual >= expected : actual <= expected;
            return (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  {p.direction === "income" ? (
                    <TrendingUp className="size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <TrendingDown className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{p.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 tabular-nums">
                  {done ? (
                    <>
                      <span>
                        {t("ledger.actual")} {money(actual)}
                      </span>
                      {magnitude >= 0.005 && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${favorable ? "text-emerald-600" : "text-destructive"}`}
                        >
                          {favorable ? "−" : "+"}
                          {money(magnitude)}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      {t("ledger.expected")} {money(expected)}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
