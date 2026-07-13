import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { confirmBucketAllocation, undoBucketAllocation } from "@/lib/bucket-allocations.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { money, yearBounds, monthBounds, fmtDate } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  PiggyBank,
  Check,
  Undo2,
  AlertTriangle,
  Target,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/allocations")({
  head: () => ({ meta: [{ title: "Allocations · Myntra" }] }),
  component: AllocationsPage,
});

type Bucket = {
  id: string;
  name: string;
  target_type: "pct_surplus" | "fixed_monthly" | "fixed_yearly" | "goal_by_date";
  target_value: number;
  target_deadline: string | null;
  color: string | null;
  initial_balance: number;
};

function AllocationsPage() {
  const t = useT();
  const activeHouseholdId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const { data: hh } = useQuery({
    queryKey: ["household", activeHouseholdId],
    queryFn: () => fetchHh({ data: activeHouseholdId ? { household_id: activeHouseholdId } : {} }),
  });
  const householdId = hh?.household?.id;
  const baseline = Number(hh?.household?.baseline_budget ?? 0);

  const { data } = useQuery({
    enabled: !!householdId,
    queryKey: ["allocations", householdId],
    queryFn: async () => {
      const [{ data: incomes }, { data: buckets }, { data: firstSalary }] = await Promise.all([
        supabase.from("incomes").select("monthly_amount").eq("household_id", householdId!),
        supabase.from("buckets").select("*").eq("household_id", householdId!).order("sort_order"),
        supabase
          .from("expenses")
          .select("occurred_at")
          .eq("household_id", householdId!)
          .eq("is_salary", true)
          .order("occurred_at", { ascending: true })
          .limit(1),
      ]);
      const income = (incomes ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
      return {
        income,
        buckets: (buckets ?? []) as Bucket[],
        firstSalaryAt: firstSalary?.[0]?.occurred_at ?? null,
      };
    },
  });

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const { data: confirmations, refetch: refetchConfirmations } = useQuery({
    enabled: !!householdId,
    queryKey: ["bucket-allocations", householdId, period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bucket_allocations")
        .select("*")
        .eq("household_id", householdId!)
        .eq("period", period);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: history } = useQuery({
    enabled: !!householdId,
    queryKey: ["bucket-allocations-history", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bucket_allocations")
        .select("*")
        .eq("household_id", householdId!)
        .order("period", { ascending: false })
        .order("confirmed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Cumulative totals per bucket across all confirmations — for goal progress.
  const { data: goalTotals } = useQuery({
    enabled: !!householdId,
    queryKey: ["bucket-allocations-totals", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bucket_allocations")
        .select("bucket_id, amount")
        .eq("household_id", householdId!);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) map[r.bucket_id] = (map[r.bucket_id] ?? 0) + Number(r.amount);
      return map;
    },
  });
  // YTD confirmed allocations (this calendar year) grouped by bucket.
  const yearStartIso = `${now.getFullYear()}-01-01`;
  const { data: ytdTotals } = useQuery({
    enabled: !!householdId,
    queryKey: ["bucket-allocations-ytd", householdId, now.getFullYear()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bucket_allocations")
        .select("bucket_id, amount")
        .eq("household_id", householdId!)
        .gte("period", yearStartIso);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) map[r.bucket_id] = (map[r.bucket_id] ?? 0) + Number(r.amount);
      return map;
    },
  });

  const income = data?.income ?? 0;
  const surplus = Math.max(0, income - baseline);

  function monthsUntil(dateStr: string | null): number {
    if (!dateStr) return 0;
    const target = new Date(dateStr);
    const now = new Date();
    const months =
      (target.getFullYear() - now.getFullYear()) * 12 +
      (target.getMonth() - now.getMonth()) +
      (target.getDate() >= now.getDate() ? 0 : -1) +
      1;
    return Math.max(1, months);
  }

  function monthly(b: Bucket): number {
    const v = Number(b.target_value);
    if (b.target_type === "pct_surplus") return (surplus * v) / 100;
    if (b.target_type === "fixed_monthly") return v;
    if (b.target_type === "fixed_yearly") return v / 12;
    return v / monthsUntil(b.target_deadline);
  }

  const totalAllocated = (data?.buckets ?? []).reduce((s, b) => s + monthly(b), 0);
  const unallocated = surplus - totalAllocated;

  // Cycle-close warning (option 4): once we're past the ~last week of the month,
  // flag buckets that still have no confirmation for the current period.
  const daysLeftInMonth =
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const unconfirmedBuckets = (data?.buckets ?? []).filter(
    (b) => !confirmations?.some((c) => c.bucket_id === b.id),
  );
  const showCloseWarning = daysLeftInMonth <= 7 && unconfirmedBuckets.length > 0;
  const totalConfirmedThisMonth = (confirmations ?? []).reduce((s, c) => s + Number(c.amount), 0);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-display">{t("alloc.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("alloc.subtitle")}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label={t("alloc.stat.income")} value={money(income)} />
        <Stat label={t("alloc.stat.baseline")} value={money(baseline)} />
        <Stat label={t("alloc.stat.surplus")} value={money(surplus)} highlight />
      </div>

      {showCloseWarning && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              {daysLeftInMonth === 0
                ? t("alloc.close.endsToday")
                : t("alloc.close.endsIn", { days: daysLeftInMonth })}
              {" · "}
              {t("alloc.close.unconfirmed", { count: unconfirmedBuckets.length })}
            </p>
            <p className="text-muted-foreground mt-0.5">
              {unconfirmedBuckets.map((b) => b.name).join(", ")}
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("alloc.thisMonth.title")}</CardTitle>
          <CardDescription>{t("alloc.thisMonth.desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.buckets?.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {t("alloc.thisMonth.empty")}
            </p>
          ) : (
            <div className="space-y-4">
              {surplus > 0 && (
                <div className="space-y-2">
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                    {data.buckets.map((b) => {
                      const amt = monthly(b);
                      const w = Math.max(0, Math.min(100, (amt / surplus) * 100));
                      if (w <= 0) return null;
                      return (
                        <div
                          key={b.id}
                          style={{ width: `${w}%`, background: b.color ?? "var(--primary)" }}
                          title={`${b.name} · ${money(amt)}`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {t("alloc.summary.allocated", {
                        allocated: money(Math.min(totalAllocated, surplus)),
                        surplus: money(surplus),
                      })}
                    </span>
                    <span className={unallocated < 0 ? "text-destructive" : ""}>
                      {unallocated < 0
                        ? t("alloc.summary.overBy", { value: money(-unallocated) })
                        : t("alloc.summary.unallocated", { value: money(unallocated) })}
                    </span>
                  </div>
                </div>
              )}
              {data.buckets.map((b) => {
                const amount = monthly(b);
                const confirmed = confirmations?.find((c) => c.bucket_id === b.id);
                const isGoal = b.target_type === "goal_by_date";
                // Current balance = whatever the household already had saved before we
                // started tracking this bucket, plus every confirmed contribution since.
                const initialBalance = Number(b.initial_balance ?? 0);
                const saved = initialBalance + (goalTotals?.[b.id] ?? 0);
                const goalTarget = Number(b.target_value);
                const goalPct =
                  isGoal && goalTarget > 0 ? Math.min(100, (saved / goalTarget) * 100) : 0;
                // On-track check: expected saved by now = monthly * months since bucket started tracking
                // Approximation: use months elapsed since (deadline - required months).
                const monthsLeft = isGoal ? monthsUntil(b.target_deadline) : 0;
                const expectedByNow = isGoal ? Math.max(0, goalTarget - amount * monthsLeft) : 0;
                const onTrack = isGoal ? saved >= expectedByNow - 0.01 : true;
                return (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex justify-between items-baseline gap-3 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ background: b.color ?? "var(--primary)" }}
                        />
                        <span className="font-medium">{b.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {b.target_type === "pct_surplus"
                            ? `${b.target_value}% of surplus`
                            : b.target_type === "fixed_monthly"
                              ? `${money(b.target_value)} / month`
                              : b.target_type === "fixed_yearly"
                                ? `${money(b.target_value)} / year`
                                : `${money(b.target_value)} by ${b.target_deadline ?? "—"} (${monthsUntil(b.target_deadline)} mo left)`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium tabular-nums">{money(amount)}</span>
                        <ConfirmAllocationButton
                          householdId={householdId!}
                          bucketId={b.id}
                          bucketName={b.name}
                          period={period}
                          suggested={amount}
                          confirmed={confirmed ?? null}
                          isGoal={isGoal}
                          goalTarget={isGoal ? goalTarget : 0}
                          savedSoFar={isGoal ? saved : 0}
                          monthsLeft={isGoal ? monthsLeft : 0}
                          unallocatedSurplus={unallocated}
                          onChanged={() => refetchConfirmations()}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {t("alloc.balance", { value: money(saved) })}
                      {initialBalance > 0 && (
                        <span>
                          {" "}
                          · {t("alloc.balance.includesInitial", { value: money(initialBalance) })}
                        </span>
                      )}
                    </p>

                    {isGoal && (
                      <div className="mt-2 rounded-md bg-muted/40 px-3 py-2 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Target className="size-3.5" /> Goal progress
                          </span>
                          <span className="tabular-nums">
                            <span className="font-medium">{money(saved)}</span>
                            <span className="text-muted-foreground">
                              {" "}
                              / {money(goalTarget)} ({goalPct.toFixed(0)}%)
                            </span>
                          </span>
                        </div>
                        <Progress value={goalPct} />
                        <p className={`text-xs ${onTrack ? "text-emerald-600" : "text-amber-600"}`}>
                          {onTrack
                            ? `On track · ${money(saved - expectedByNow)} ahead of schedule`
                            : `Behind by ${money(expectedByNow - saved)} · need ${money((goalTarget - saved) / Math.max(1, monthsLeft))}/mo to catch up`}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="pt-3 mt-3 border-t space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("alloc.totals.monthly")}</span>
                  <span className="tabular-nums font-medium">{money(totalAllocated)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("alloc.totals.confirmed")}</span>
                  <span className="tabular-nums font-medium text-emerald-600">
                    {money(totalConfirmedThisMonth)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("alloc.totals.emergency")}</span>
                  <span
                    className={`tabular-nums font-medium ${unallocated < 0 ? "text-destructive" : ""}`}
                  >
                    {money(unallocated)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AllocationHistory
        history={history ?? []}
        buckets={data?.buckets ?? []}
        householdId={householdId!}
      />

      <YearToDate
        buckets={data?.buckets ?? []}
        monthlyFn={monthly}
        firstSalaryAt={data?.firstSalaryAt ?? null}
        ytdTotals={ytdTotals ?? {}}
        allTimeTotals={goalTotals ?? {}}
      />
    </div>
  );
}

function YearToDate({
  buckets,
  monthlyFn,
  firstSalaryAt,
  ytdTotals,
  allTimeTotals,
}: {
  buckets: Bucket[];
  monthlyFn: (b: Bucket) => number;
  firstSalaryAt: string | null;
  ytdTotals: Record<string, number>;
  allTimeTotals: Record<string, number>;
}) {
  const now = new Date();
  const year = now.getFullYear();
  const start =
    firstSalaryAt && new Date(firstSalaryAt).getFullYear() === year
      ? new Date(firstSalaryAt)
      : new Date(year, 0, 1);
  const msPerMonth = (365.25 / 12) * 86400000;
  const monthsElapsed = Math.max(0, Math.min(12, (now.getTime() - start.getTime()) / msPerMonth));
  const monthsRemaining = Math.max(0, 12 - (now.getMonth() + now.getDate() / 30));
  const startLabel = start.toLocaleDateString("en-GB");
  const ytdConfirmedTotal = buckets.reduce((s, b) => s + (ytdTotals[b.id] ?? 0), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PiggyBank className="size-5" /> Year-to-date (actuals)
        </CardTitle>
        <CardDescription>
          Sum of allocations you confirmed this year (since {startLabel}). Projection assumes
          current monthly target continues until year end.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!buckets.length ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {buckets.map((b) => {
                const confirmed = ytdTotals[b.id] ?? 0;
                // Current balance = pre-existing initial funds + every confirmed contribution
                // ever made (not just this year) — the real amount sitting in the bucket today.
                const currentBalance = Number(b.initial_balance ?? 0) + (allTimeTotals[b.id] ?? 0);
                const projected = currentBalance + monthlyFn(b) * monthsRemaining;
                return (
                  <div key={b.id} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: b.color ?? "var(--primary)" }}
                      />
                      <span className="font-medium text-sm">{b.name}</span>
                    </div>
                    <p className="text-2xl font-display tabular-nums">{money(currentBalance)}</p>
                    <p className="text-xs text-muted-foreground">
                      {money(confirmed)} confirmed this year
                    </p>
                    <p className="text-xs text-muted-foreground">
                      On pace for <span className="tabular-nums">{money(projected)}</span> by year
                      end
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="pt-3 border-t flex justify-between text-sm">
              <span className="text-muted-foreground">
                Total confirmed YTD ({monthsElapsed.toFixed(1)} mo)
              </span>
              <span className="tabular-nums font-medium">{money(ytdConfirmedTotal)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/5" : ""}>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-2xl font-display mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

type Confirmation = {
  id: string;
  bucket_id: string;
  period: string;
  amount: number | string;
  note: string | null;
  confirmed_at: string;
};

function ConfirmAllocationButton({
  householdId,
  bucketId,
  bucketName,
  period,
  suggested,
  confirmed,
  isGoal,
  goalTarget,
  savedSoFar,
  monthsLeft,
  unallocatedSurplus,
  onChanged,
}: {
  householdId: string;
  bucketId: string;
  bucketName: string;
  period: string;
  suggested: number;
  confirmed: Confirmation | null;
  isGoal: boolean;
  goalTarget: number;
  savedSoFar: number;
  monthsLeft: number;
  unallocatedSurplus: number;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const confirmFn = useServerFn(confirmBucketAllocation);
  const undoFn = useServerFn(undoBucketAllocation);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(suggested.toFixed(2));
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const parsed = useMemo(() => {
    const n = parseFloat(amount.replace(",", "."));
    return isFinite(n) && n >= 0 ? n : null;
  }, [amount]);

  const delta = parsed !== null ? parsed - suggested : 0;
  const newUnallocated = unallocatedSurplus - delta; // surplus goes down if you allocate more
  const newSaved = savedSoFar + (parsed ?? 0);
  const remainingToGoal = Math.max(0, goalTarget - newSaved);
  const newMonthlyNeeded =
    isGoal && monthsLeft > 1 ? remainingToGoal / Math.max(1, monthsLeft - 1) : 0;
  const goalPctAfter = isGoal && goalTarget > 0 ? Math.min(100, (newSaved / goalTarget) * 100) : 0;

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["bucket-allocations-history", householdId] });
    qc.invalidateQueries({ queryKey: ["bucket-allocations-totals", householdId] });
    qc.invalidateQueries({
      queryKey: ["bucket-allocations-ytd", householdId, new Date().getFullYear()],
    });
  }

  async function submit() {
    if (parsed === null) return toast.error("Invalid amount");
    setLoading(true);
    try {
      await confirmFn({
        data: {
          household_id: householdId,
          bucket_id: bucketId,
          period,
          amount: parsed,
          note: note.trim() || null,
        },
      });
      toast.success("Allocation confirmed");
      setOpen(false);
      setNote("");
      onChanged();
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }
  async function undo() {
    if (!confirmed) return;
    setLoading(true);
    try {
      await undoFn({ data: { id: confirmed.id } });
      toast.success("Confirmation removed");
      onChanged();
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  if (confirmed) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
          <Check className="size-3.5" /> {money(confirmed.amount)} moved
        </span>
        <Button size="sm" variant="ghost" onClick={undo} disabled={loading}>
          <Undo2 className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setAmount(suggested.toFixed(2));
          setNote("");
          setOpen(true);
        }}
      >
        Mark as allocated
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Allocate to {bucketName}</DialogTitle>
            <DialogDescription>How much did you actually move to this bucket?</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 px-3 py-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Recommended this month</span>
              <span className="tabular-nums font-medium">{money(suggested)}</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="alloc-amt">Amount moved (€)</Label>
              <Input
                id="alloc-amt"
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setAmount(suggested.toFixed(2))}
                >
                  Use recommended
                </Button>
                {isGoal && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setAmount(Math.max(0, goalTarget - savedSoFar).toFixed(2))}
                  >
                    Fund remainder ({money(Math.max(0, goalTarget - savedSoFar))})
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="alloc-note">Note (optional)</Label>
              <Textarea
                id="alloc-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. bonus month, skipped due to travel…"
              />
            </div>

            {parsed !== null && (
              <div className="rounded-md border p-3 space-y-2 text-sm">
                <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground">
                  Impact
                </p>

                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    {delta >= 0 ? (
                      <TrendingUp className="size-3.5" />
                    ) : (
                      <TrendingDown className="size-3.5" />
                    )}
                    vs recommended
                  </span>
                  <span
                    className={`tabular-nums font-medium ${Math.abs(delta) < 0.01 ? "" : delta > 0 ? "text-amber-600" : "text-sky-600"}`}
                  >
                    {delta === 0 ? "on target" : `${delta > 0 ? "+" : ""}${money(delta)}`}
                  </span>
                </div>

                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground">
                    Emergency / unallocated surplus after
                  </span>
                  <span
                    className={`tabular-nums font-medium ${newUnallocated < 0 ? "text-destructive" : "text-emerald-600"}`}
                  >
                    {money(newUnallocated)}
                  </span>
                </div>

                {isGoal && goalTarget > 0 && (
                  <>
                    <div className="pt-2 border-t space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Target className="size-3.5" /> Goal after this
                        </span>
                        <span className="tabular-nums">
                          {money(newSaved)} / {money(goalTarget)} ({goalPctAfter.toFixed(0)}%)
                        </span>
                      </div>
                      <Progress value={goalPctAfter} />
                      {monthsLeft > 1 && remainingToGoal > 0 && (
                        <p
                          className={`text-xs ${newMonthlyNeeded > suggested + 0.01 ? "text-amber-600" : "text-muted-foreground"}`}
                        >
                          {newMonthlyNeeded > suggested + 0.01
                            ? `You'll need ${money(newMonthlyNeeded)}/mo (up from ${money(suggested)}) to hit the goal.`
                            : `On track — ${money(newMonthlyNeeded)}/mo needed for the remaining ${monthsLeft - 1} month(s).`}
                        </p>
                      )}
                      {remainingToGoal === 0 && (
                        <p className="text-xs text-emerald-600">Goal reached 🎉</p>
                      )}
                    </div>
                  </>
                )}

                {newUnallocated < 0 && (
                  <p className="text-xs text-destructive flex items-start gap-1.5">
                    <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                    This overspends the month's surplus by {money(-newUnallocated)} — it'll come
                    from your emergency pool.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={loading || parsed === null}>
              Confirm allocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AllocationHistory({
  history,
  buckets,
  householdId,
}: {
  history: Confirmation[];
  buckets: Bucket[];
  householdId: string;
}) {
  const qc = useQueryClient();
  const undoFn = useServerFn(undoBucketAllocation);
  const nameOf = (id: string) => buckets.find((b) => b.id === id)?.name ?? "—";
  const colorOf = (id: string) => buckets.find((b) => b.id === id)?.color ?? "var(--primary)";

  async function undo(id: string) {
    try {
      await undoFn({ data: { id } });
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["bucket-allocations-history", householdId] });
      qc.invalidateQueries({ queryKey: ["bucket-allocations-totals", householdId] });
      qc.invalidateQueries({
        queryKey: ["bucket-allocations-ytd", householdId, new Date().getFullYear()],
      });
      qc.invalidateQueries({ queryKey: ["bucket-allocations", householdId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  // Group by period
  const grouped = history.reduce<Record<string, Confirmation[]>>((acc, c) => {
    (acc[c.period] ||= []).push(c);
    return acc;
  }, {});
  const periods = Object.keys(grouped).sort().reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirmation history</CardTitle>
        <CardDescription>
          Track which bucket allocations you actually moved each month.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!periods.length ? (
          <p className="text-sm text-muted-foreground py-4">No confirmations yet.</p>
        ) : (
          <div className="space-y-4">
            {periods.map((p) => {
              const total = grouped[p].reduce((s, c) => s + Number(c.amount), 0);
              const label = new Date(p).toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
              });
              return (
                <div key={p}>
                  <div className="flex justify-between text-sm font-medium mb-2">
                    <span>{label}</span>
                    <span className="tabular-nums">{money(total)}</span>
                  </div>
                  <ul className="divide-y rounded-md border">
                    {grouped[p].map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ background: colorOf(c.bucket_id) }}
                          />
                          <span className="truncate">{nameOf(c.bucket_id)}</span>
                          <span className="text-xs text-muted-foreground">
                            · {fmtDate(c.confirmed_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums font-medium">{money(c.amount)}</span>
                          <Button size="sm" variant="ghost" onClick={() => undo(c.id)}>
                            <Undo2 className="size-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
