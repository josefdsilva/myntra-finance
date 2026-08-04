import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCycleBounds } from "@/lib/cycle-bounds";
import { sumMonthly } from "@/lib/finance-helpers";
import { emitCoachMessage } from "@/lib/coach-messages.server";
import {
  driftSignals,
  costReminderSignals,
  recapSignal,
  milestoneSignals,
  moneyFormatter,
  type PlanRow,
  type CycleMetric,
  type Signal,
} from "@/lib/coach-signals";
import { gatherRunwayReceivables } from "@/lib/sme-cash.server";
import { smeSignals } from "@/lib/sme-signals";

// Single source of truth for "run the coach for one space". Both the on-open
// daily trigger and the (optional) cron hooks call this, so the logic lives in
// exactly one place. Every emit is idempotent via its dedupe key.

export type CoachHousehold = {
  id: string;
  kind: string | null;
  currency: string | null;
  baseline_budget: number | string | null;
  cycle: string | null;
  cycle_mode: string | null;
  cycle_anchor_date: string | null;
};

export async function runCoachForHousehold(
  admin: SupabaseClient,
  hh: CoachHousehold,
  now: Date = new Date(),
): Promise<number> {
  const money = moneyFormatter(hh.currency);
  let emitted = 0;
  const emit = async (s: Signal, cycleStart?: string | null) => {
    const r = await emitCoachMessage(admin, {
      householdId: hh.id,
      userId: null,
      kind: s.kind,
      severity: s.severity,
      title: s.title,
      body: s.body,
      actionLabel: s.actionLabel,
      actionUrl: s.actionUrl,
      data: s.data,
      cycleStart: cycleStart ?? null,
      dedupeKey: s.dedupeKey,
    });
    if (r.created) emitted++;
  };

  // --- Business spaces: runway + receivables ---
  if (hh.kind === "business") {
    const picture = await gatherRunwayReceivables(admin, hh.id);
    const periodKey = now.toISOString().slice(0, 7);
    for (const s of smeSignals({
      runway: picture.runway,
      receivables: picture.receivables,
      money,
      periodKey,
    })) {
      await emit(s);
    }
    return emitted;
  }

  // --- Personal spaces: drift + cost reminders + recap + milestones ---
  const baseline = Number(hh.baseline_budget ?? 0);
  // Current cycle bounds — used for drift, and to confirm a recap is for a cycle
  // strictly before the current one (so we never announce a close that has not
  // happened yet).
  const cycle = await fetchCycleBounds(admin, hh.id, hh);

  if (baseline > 0) {
    const [{ data: fixed }, { data: debts }] = await Promise.all([
      admin.from("fixed_expenses").select("monthly_amount").eq("household_id", hh.id),
      admin.from("debts").select("monthly_amount").eq("household_id", hh.id),
    ]);
    const fixedTotal =
      sumMonthly(fixed as Array<{ monthly_amount: number | string }> | null) +
      sumMonthly(debts as Array<{ monthly_amount: number | string }> | null);
    const variablePool = Math.max(0, baseline - fixedTotal);

    const { data: cycleExp } = await admin
      .from("expenses")
      .select("amount, kind, is_salary")
      .eq("household_id", hh.id)
      .gte("occurred_at", cycle.start.toISOString())
      .lt("occurred_at", cycle.end.toISOString());
    const rows =
      (cycleExp as Array<{ amount: number | string; kind: string; is_salary: boolean }> | null) ?? [];
    const spent = rows.filter((r) => r.kind !== "income").reduce((s, r) => s + Number(r.amount), 0);
    const received = rows
      .filter((r) => r.kind === "income" && !r.is_salary)
      .reduce((s, r) => s + Number(r.amount), 0);
    const netSpent = Math.max(0, spent - received);
    const baselineRatio = variablePool > 0 ? netSpent / variablePool : netSpent > 0 ? 1 : 0;

    const { data: incomes } = await admin
      .from("incomes")
      .select("monthly_amount")
      .eq("household_id", hh.id);
    const income = sumMonthly(incomes as Array<{ monthly_amount: number | string }> | null);
    const surplus = Math.max(0, income - baseline);
    const overspend = Math.max(0, netSpent - variablePool);
    const emergencyRatio = surplus > 0 ? overspend / surplus : overspend > 0 ? 1 : 0;
    const cycleKey = cycle.start.toISOString().slice(0, 10);

    for (const s of driftSignals({
      cycleKey,
      netSpent,
      variablePool,
      baselineRatio,
      surplus,
      overspend,
      emergencyRatio,
      money,
    })) {
      await emit(s, cycleKey);
    }
  }

  // Cost reminders from Plans.
  const { data: plans } = await admin
    .from("plans")
    .select("id, label, amount, month, direction, recurrence, done, bucket_id")
    .eq("household_id", hh.id)
    .eq("done", false);
  for (const s of costReminderSignals({
    plans: (plans as PlanRow[] | null) ?? [],
    now,
    money,
  })) {
    await emit(s);
  }

  // Recap + milestones from the per-cycle history.
  const { data: cmRows } = await admin
    .from("cycle_metrics" as never)
    .select(
      "cycle_start, cycle_end, income_actual, spend_actual, surplus_actual, everyday_pool, everyday_spent, score_overall",
    )
    .eq("household_id", hh.id)
    .order("cycle_start", { ascending: false })
    .limit(12);
  const series: CycleMetric[] = ((cmRows as Array<Record<string, unknown>> | null) ?? [])
    .map((r) => ({
      cycle_start: String(r.cycle_start),
      cycle_end: String(r.cycle_end),
      income_actual: Number(r.income_actual) || 0,
      spend_actual: Number(r.spend_actual) || 0,
      surplus_actual: Number(r.surplus_actual) || 0,
      everyday_pool: Number(r.everyday_pool) || 0,
      everyday_spent: Number(r.everyday_spent) || 0,
      score_overall: r.score_overall == null ? null : Number(r.score_overall),
    }))
    .reverse();

  if (series.length > 0) {
    const latest = series[series.length - 1];
    const prev = series.length >= 2 ? series[series.length - 2] : null;
    // Only recap a cycle that is genuinely closed: its start must be strictly
    // before the current cycle's start, and it must have ended recently.
    const isPastCycle = new Date(latest.cycle_start).getTime() < cycle.start.getTime();
    const closedDaysAgo = (now.getTime() - new Date(latest.cycle_end).getTime()) / 86_400_000;
    if (isPastCycle && closedDaysAgo >= 0 && closedDaysAgo <= 12) {
      await emit(recapSignal({ latest, prev, money }), latest.cycle_start);
    }
    for (const s of milestoneSignals({ series })) {
      await emit(s, latest.cycle_start);
    }
  }

  return emitted;
}
