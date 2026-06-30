// Pay-cycle helpers. Detect the current cycle from salary income entries.
// cycleStart = most recent salary occurred_at
// cycleEnd   = next expected salary date (predicted from prior interval, default +1 month)
// If no salary entries exist, fall back to calendar month.

export type CycleBounds = {
  start: Date;
  end: Date;
  daysLeft: number;
  daysTotal: number;
  source: "salary" | "calendar";
  lastSalaryAt: Date | null;
  predicted: boolean; // true when cycleEnd is predicted (no second salary yet)
};

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/**
 * @param salaryDatesDesc occurred_at strings of past salary entries, newest first
 */
export function computeCycle(salaryDatesDesc: string[], now = new Date()): CycleBounds {
  if (!salaryDatesDesc.length) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
      start,
      end,
      daysLeft: Math.max(1, diffDays(end, now)),
      daysTotal: diffDays(end, start),
      source: "calendar",
      lastSalaryAt: null,
      predicted: true,
    };
  }
  const last = new Date(salaryDatesDesc[0]);
  // Predict next salary
  let next: Date;
  let predicted = true;
  if (salaryDatesDesc.length >= 2) {
    const prev = new Date(salaryDatesDesc[1]);
    const intervalDays = diffDays(last, prev);
    // Sanity: between 20 and 45 days → use it; else default to monthly
    if (intervalDays >= 20 && intervalDays <= 45) {
      next = new Date(last.getTime() + intervalDays * 86400000);
      predicted = false; // based on observed cadence
    } else {
      next = addMonths(last, 1);
    }
  } else {
    next = addMonths(last, 1);
  }
  const daysTotal = Math.max(1, diffDays(next, last));
  const daysLeft = Math.max(1, diffDays(next, now));
  return {
    start: last,
    end: next,
    daysLeft,
    daysTotal,
    source: "salary",
    lastSalaryAt: last,
    predicted,
  };
}
