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
