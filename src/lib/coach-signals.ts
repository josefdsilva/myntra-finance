// Pure, deterministic rules that turn grounded facts into candidate coach
// nudges. No I/O here — the cron hooks gather the numbers, call these, and pass
// the results to the emit funnel. Kept pure so it is easy to unit test the
// thresholds and copy without a database.

export type Signal = {
  kind: string;
  severity: "info" | "success" | "warn" | "critical";
  title: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
  /** Stable within a household so the same nudge posts only once. */
  dedupeKey: string;
};

export type Money = (n: number) => string;

/** Currency formatter for the cron (server) side, whole units. */
export function moneyFormatter(currency: string | null | undefined): Money {
  const cur = currency || "EUR";
  let nf: Intl.NumberFormat;
  try {
    nf = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 0,
    });
  } catch {
    nf = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });
  }
  return (n: number) => nf.format(Math.round(n));
}

// ---- Mid-cycle drift -------------------------------------------------------

export function driftSignals(p: {
  cycleKey: string;
  netSpent: number;
  variablePool: number;
  baselineRatio: number;
  surplus: number;
  overspend: number;
  emergencyRatio: number;
  money: Money;
}): Signal[] {
  const { cycleKey, netSpent, variablePool, baselineRatio, surplus, overspend, emergencyRatio, money } =
    p;
  const out: Signal[] = [];

  if (variablePool > 0) {
    if (baselineRatio >= 1) {
      out.push({
        kind: "baseline_reached",
        severity: "critical",
        title: "Everyday budget spent",
        body: `You have used all of this cycle's everyday budget (${money(netSpent)} of ${money(
          variablePool,
        )}). Anything more dips into your surplus.`,
        actionLabel: "Review spending",
        actionUrl: "/dashboard",
        dedupeKey: `baseline_reached:${cycleKey}`,
      });
    } else if (baselineRatio >= 0.8) {
      out.push({
        kind: "baseline_warn",
        severity: "warn",
        title: "80% of your everyday budget used",
        body: `${money(netSpent)} of ${money(
          variablePool,
        )} spent with time still to go. Ease off to stay within plan.`,
        actionLabel: "See safe to spend",
        actionUrl: "/dashboard",
        dedupeKey: `baseline_warn:${cycleKey}`,
      });
    }
  }

  if (surplus > 0) {
    if (emergencyRatio >= 1) {
      out.push({
        kind: "emergency_depleted",
        severity: "critical",
        title: "Overspend is eating your surplus",
        body: `Overspend of ${money(overspend)} has used your whole monthly surplus (${money(
          surplus,
        )}). Worth pausing non-essentials.`,
        actionLabel: "Open coach",
        actionUrl: "/analysis",
        dedupeKey: `emergency_depleted:${cycleKey}`,
      });
    } else if (emergencyRatio >= 0.8) {
      out.push({
        kind: "emergency_warn",
        severity: "warn",
        title: "Surplus at risk",
        body: `Overspend of ${money(overspend)} is using ${Math.round(
          emergencyRatio * 100,
        )}% of your monthly surplus.`,
        actionLabel: "Open coach",
        actionUrl: "/analysis",
        dedupeKey: `emergency_warn:${cycleKey}`,
      });
    }
  }

  return out;
}

// ---- Upcoming cost reminders ----------------------------------------------

export type PlanRow = {
  id: string;
  label: string;
  amount: number;
  month: string; // first day of the plan's month
  direction: string; // 'spend' | 'income'
  recurrence: string; // 'one_off' | 'annual' | 'ongoing'
  done: boolean;
  bucket_id: string | null;
};

function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Next date this plan lands on or after the current month. Null = not remindable. */
export function nextOccurrence(plan: PlanRow, now: Date): Date | null {
  const m = new Date(plan.month);
  if (Number.isNaN(m.getTime())) return null;
  if (plan.recurrence === "one_off") return startOfMonthUTC(m);
  if (plan.recurrence === "annual") {
    const monthIdx = m.getUTCMonth();
    const som = startOfMonthUTC(now);
    let occ = new Date(Date.UTC(now.getUTCFullYear(), monthIdx, 1));
    if (occ < som) occ = new Date(Date.UTC(now.getUTCFullYear() + 1, monthIdx, 1));
    return occ;
  }
  return null; // ongoing is not a lumpy event, do not remind
}

// ---- End-of-cycle recap + milestones --------------------------------------

export type CycleMetric = {
  cycle_start: string;
  cycle_end: string;
  income_actual: number;
  spend_actual: number;
  surplus_actual: number;
  everyday_pool: number;
  everyday_spent: number;
  score_overall: number | null;
};

/** A recap of the just-closed cycle plus the single most useful next action. */
export function recapSignal(p: {
  latest: CycleMetric;
  prev?: CycleMetric | null;
  money: Money;
}): Signal {
  const { latest, prev, money } = p;
  const overEveryday = latest.everyday_spent - latest.everyday_pool;
  const scoreDelta =
    latest.score_overall != null && prev?.score_overall != null
      ? latest.score_overall - prev.score_overall
      : null;

  let action: string;
  let severity: Signal["severity"] = "info";
  if (overEveryday > 1 && latest.everyday_pool > 0) {
    action = `You went ${money(overEveryday)} over your everyday budget. Trimming a little next cycle keeps your surplus intact.`;
    severity = "warn";
  } else if (latest.surplus_actual > 1) {
    action = `You finished ${money(
      latest.surplus_actual,
    )} ahead. Put it to work in a project before it drifts into everyday spending.`;
    severity = "success";
  } else {
    action = `Steady cycle. Keep everyday spend inside the plan to grow next month's surplus.`;
  }

  const scoreLine =
    scoreDelta != null
      ? ` Health score ${latest.score_overall} (${scoreDelta >= 0 ? "+" : ""}${scoreDelta}).`
      : "";

  return {
    kind: "cycle_recap",
    severity,
    title: "Your cycle just closed",
    body: `Spent ${money(latest.spend_actual)}, received ${money(
      latest.income_actual,
    )}.${scoreLine} ${action}`,
    actionLabel: "See analysis",
    actionUrl: "/analysis",
    dedupeKey: `cycle_recap:${latest.cycle_start}`,
  };
}

/** Wins worth celebrating, from the per-cycle history (ascending by start). */
export function milestoneSignals(p: { series: CycleMetric[] }): Signal[] {
  const { series } = p;
  const out: Signal[] = [];
  if (series.length < 2) return out;
  const latest = series[series.length - 1];
  const prev = series[series.length - 2];

  if (latest.score_overall != null && prev.score_overall != null) {
    const d = latest.score_overall - prev.score_overall;
    if (d >= 4) {
      out.push({
        kind: "milestone_score",
        severity: "success",
        title: `Health score up to ${latest.score_overall}`,
        body: `That is ${d} points better than last cycle. Whatever you changed, it worked.`,
        actionLabel: "See snapshot",
        actionUrl: "/snapshot",
        dedupeKey: `milestone_score:${latest.cycle_start}`,
      });
    }
  }

  let streak = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].surplus_actual > 0) streak++;
    else break;
  }
  if (streak >= 3) {
    out.push({
      kind: "milestone_streak",
      severity: "success",
      title: `${streak} cycles in the black`,
      body: `You have finished ${streak} cycles in a row with money to spare. That is how wealth builds.`,
      actionLabel: "Keep going",
      actionUrl: "/dashboard",
      dedupeKey: `milestone_streak:${streak}:${latest.cycle_start}`,
    });
  }

  return out;
}

export function costReminderSignals(p: {
  plans: PlanRow[];
  now: Date;
  horizonDays?: number;
  money: Money;
}): Signal[] {
  const { plans, now, money } = p;
  const horizon = p.horizonDays ?? 45;
  const som = startOfMonthUTC(now);
  const out: Signal[] = [];
  for (const plan of plans) {
    if (plan.direction !== "spend") continue;
    if (plan.done) continue;
    if (plan.bucket_id) continue; // already being funded via a sinking-fund project
    const occ = nextOccurrence(plan, now);
    if (!occ || occ < som) continue;
    const days = (occ.getTime() - now.getTime()) / 86_400_000;
    if (days > horizon) continue;
    const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(
      occ,
    );
    const occKey = occ.toISOString().slice(0, 7);
    out.push({
      kind: "cost_reminder",
      severity: "info",
      title: `Set aside for ${plan.label}`,
      body: `${money(plan.amount)} is due around ${monthName}. Setting it aside now keeps it from denting that cycle.`,
      actionLabel: "Plan it",
      actionUrl: "/plan",
      dedupeKey: `cost_reminder:${plan.id}:${occKey}`,
    });
  }
  return out;
}
