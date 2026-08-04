// Pure receivables aging for SMEs. Money the business is owed, from planned
// money-in that has not been received yet, bucketed by how overdue it is.
// Deterministic and unit-tested.

export type ReceivablePlan = {
  id: string;
  label: string;
  amount: number;
  month: string; // first day of the month the payment is expected
  recurrence: string; // 'one_off' | 'annual' | 'ongoing'
  done: boolean; // received / resolved
};

export type AgeBucket = "not_due" | "d0_30" | "d31_60" | "d61_90" | "d90_plus";

export type AgedReceivable = {
  id: string;
  label: string;
  amount: number;
  dueDate: string; // ISO date (end of the expected month)
  daysOverdue: number;
  bucket: AgeBucket;
};

export type ReceivablesResult = {
  items: AgedReceivable[];
  total: number;
  overdueTotal: number;
  buckets: Record<AgeBucket, { count: number; amount: number }>;
};

const BUCKET_KEYS: AgeBucket[] = ["not_due", "d0_30", "d31_60", "d61_90", "d90_plus"];

function endOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

/** Due date to age against: end of the month the payment is expected in. */
export function dueDateFor(plan: ReceivablePlan, now: Date): Date | null {
  const m = new Date(plan.month);
  if (Number.isNaN(m.getTime())) return null;
  if (plan.recurrence === "one_off") return endOfMonthUTC(m);
  if (plan.recurrence === "annual") {
    const monthIdx = m.getUTCMonth();
    const thisYear = new Date(Date.UTC(now.getUTCFullYear(), monthIdx, 1));
    const som = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const occ = thisYear < som ? new Date(Date.UTC(now.getUTCFullYear() + 1, monthIdx, 1)) : thisYear;
    return endOfMonthUTC(occ);
  }
  return null; // ongoing is a recurring stream, not a one-off receivable
}

function bucketFor(due: Date, now: Date): { bucket: AgeBucket; daysOverdue: number } {
  if (due >= now) return { bucket: "not_due", daysOverdue: 0 };
  const daysOverdue = Math.floor((now.getTime() - due.getTime()) / 86_400_000);
  const bucket: AgeBucket =
    daysOverdue <= 30 ? "d0_30" : daysOverdue <= 60 ? "d31_60" : daysOverdue <= 90 ? "d61_90" : "d90_plus";
  return { bucket, daysOverdue };
}

export function ageReceivables(plans: ReceivablePlan[], now: Date): ReceivablesResult {
  const buckets = Object.fromEntries(
    BUCKET_KEYS.map((k) => [k, { count: 0, amount: 0 }]),
  ) as ReceivablesResult["buckets"];
  const items: AgedReceivable[] = [];

  for (const plan of plans) {
    if (plan.done) continue;
    const due = dueDateFor(plan, now);
    if (!due) continue;
    const { bucket, daysOverdue } = bucketFor(due, now);
    items.push({
      id: plan.id,
      label: plan.label,
      amount: plan.amount,
      dueDate: due.toISOString().slice(0, 10),
      daysOverdue,
      bucket,
    });
    buckets[bucket].count += 1;
    buckets[bucket].amount += plan.amount;
  }

  // Most overdue first, then soonest due.
  items.sort((a, b) => b.daysOverdue - a.daysOverdue || a.dueDate.localeCompare(b.dueDate));

  const total = items.reduce((s, i) => s + i.amount, 0);
  const overdueTotal = items
    .filter((i) => i.bucket !== "not_due")
    .reduce((s, i) => s + i.amount, 0);

  return { items, total, overdueTotal, buckets };
}
