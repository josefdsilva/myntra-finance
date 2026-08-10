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
  /** Optional structured extras carried onto the inbox message (e.g. a draft). */
  data?: Record<string, unknown>;
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
  // Derived KPI values for the degradation watch (null/undefined when a cycle
  // did not persist enough to compute them). The first three have history on
  // older rows too; the rest accrue history from the per-cycle index snapshot.
  emergency_months?: number | null;
  dti_pct?: number | null;
  spending_vs_plan?: number | null;
  savings_rate?: number | null;
  essential_expenses_ratio?: number | null;
  housing_cost_ratio?: number | null;
  non_mortgage_debt_service?: number | null;
  debt_to_asset?: number | null;
  income_concentration?: number | null;
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

// ---- KPI degradation watch -------------------------------------------------

type WatchKey =
  | "emergency_months"
  | "dti_pct"
  | "spending_vs_plan"
  | "savings_rate"
  | "essential_expenses_ratio"
  | "housing_cost_ratio"
  | "non_mortgage_debt_service"
  | "debt_to_asset"
  | "income_concentration";

/**
 * Watch the KPIs that have real per-cycle history. When one slips the wrong way
 * for two cycles running AND lands in a concerning zone (so a healthy wobble
 * doesn't nag), suggest making it a Reach target on the journey. One message per
 * metric per cycle (deduped by the latest cycle start).
 */
export function degradationSignals(p: { series: CycleMetric[] }): Signal[] {
  const { series } = p;
  const out: Signal[] = [];
  if (series.length < 3) return out; // need two consecutive transitions
  const latest = series[series.length - 1];

  const watches: Array<{
    key: WatchKey;
    label: string;
    higherIsWorse: boolean;
    concern: (v: number) => boolean;
    op: "<=" | ">=";
    value: number;
    fmt: (v: number) => string;
  }> = [
    {
      key: "emergency_months",
      label: "emergency buffer",
      higherIsWorse: false,
      concern: (v) => v < 3,
      op: ">=",
      value: 3,
      fmt: (v) => `${v.toFixed(1)} months`,
    },
    {
      key: "dti_pct",
      label: "debt-to-income",
      higherIsWorse: true,
      concern: (v) => v > 20,
      op: "<=",
      value: 15,
      fmt: (v) => `${Math.round(v)}%`,
    },
    {
      key: "spending_vs_plan",
      label: "spending vs plan",
      higherIsWorse: true,
      concern: (v) => v > 100,
      op: "<=",
      value: 100,
      fmt: (v) => `${Math.round(v)}%`,
    },
    {
      key: "savings_rate",
      label: "savings rate",
      higherIsWorse: false,
      concern: (v) => v < 10,
      op: ">=",
      value: 15,
      fmt: (v) => `${Math.round(v)}%`,
    },
    {
      key: "essential_expenses_ratio",
      label: "essential-expenses ratio",
      higherIsWorse: true,
      concern: (v) => v > 70,
      op: "<=",
      value: 70,
      fmt: (v) => `${Math.round(v)}%`,
    },
    {
      key: "housing_cost_ratio",
      label: "housing costs",
      higherIsWorse: true,
      concern: (v) => v > 30,
      op: "<=",
      value: 30,
      fmt: (v) => `${Math.round(v)}%`,
    },
    {
      key: "non_mortgage_debt_service",
      label: "consumer-debt payments",
      higherIsWorse: true,
      concern: (v) => v > 15,
      op: "<=",
      value: 15,
      fmt: (v) => `${Math.round(v)}%`,
    },
    {
      key: "debt_to_asset",
      label: "debt-to-asset ratio",
      higherIsWorse: true,
      concern: (v) => v > 50,
      op: "<=",
      value: 40,
      fmt: (v) => `${Math.round(v)}%`,
    },
    {
      key: "income_concentration",
      label: "income concentration",
      higherIsWorse: true,
      concern: (v) => v > 80,
      op: "<=",
      value: 80,
      fmt: (v) => `${Math.round(v)}%`,
    },
  ];

  for (const w of watches) {
    const vals = series.slice(-3).map((c) => c[w.key]);
    if (vals.some((v) => v == null)) continue;
    const [a, b, c] = vals as number[];
    const worsened = w.higherIsWorse ? c > b && b > a : c < b && b < a;
    if (!worsened || !w.concern(c)) continue;
    out.push({
      kind: "kpi_degrading",
      severity: "warn",
      title: `Your ${w.label} is slipping`,
      body: `It has moved the wrong way two cycles running (now ${w.fmt(c)}). Want to make it a target on your journey and turn it around?`,
      actionLabel: "Add a target",
      actionUrl: `/journey?kpi=${w.key}&op=${encodeURIComponent(w.op)}&value=${w.value}`,
      data: { metric_key: w.key, op: w.op, value: w.value },
      dedupeKey: `kpi_degrading:${w.key}:${latest.cycle_start}`,
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
