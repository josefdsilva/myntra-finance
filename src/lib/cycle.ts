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

export type CycleSpan = { start: Date; end: Date; predicted: boolean };

/**
 * Build the full list of pay cycles (oldest first) from ascending salary dates.
 * Every cycle except the last is "closed" (bounded by two real salary events);
 * the last one is the ongoing cycle with a predicted end. Same algorithm used
 * by the Analysis page's burndown range picker, extracted here so other
 * features (e.g. the cycle report) can build the same list without
 * duplicating the interval-prediction logic.
 */
export function buildCyclesFromSalaries(salaryDatesAsc: string[]): CycleSpan[] {
  const out: CycleSpan[] = [];
  if (!salaryDatesAsc.length) return out;
  for (let i = 0; i < salaryDatesAsc.length; i++) {
    const start = new Date(salaryDatesAsc[i]);
    let end: Date;
    let predicted = false;
    if (i < salaryDatesAsc.length - 1) {
      end = new Date(salaryDatesAsc[i + 1]);
    } else {
      predicted = true;
      if (i >= 1) {
        const prev = new Date(salaryDatesAsc[i - 1]);
        const diff = start.getTime() - prev.getTime();
        const days = Math.round(diff / 86400000);
        end =
          days >= 20 && days <= 45
            ? new Date(start.getTime() + diff)
            : new Date(
                start.getFullYear(),
                start.getMonth() + 1,
                start.getDate(),
                start.getHours(),
                start.getMinutes(),
              );
      } else {
        end = new Date(
          start.getFullYear(),
          start.getMonth() + 1,
          start.getDate(),
          start.getHours(),
          start.getMinutes(),
        );
      }
    }
    out.push({ start, end, predicted });
  }
  return out;
}
