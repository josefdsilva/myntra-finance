// Pay-cycle helpers. Detect the current cycle from salary income entries.
// cycleStart = most recent salary occurred_at
// cycleEnd   = next expected salary date (predicted from prior interval, default +1 month)
// If no salary entries exist, fall back to calendar month.

import type { Cycle } from "./cadence";
import { cycleForSpace } from "./cadence";

export type CycleBounds = {
  start: Date;
  end: Date;
  daysLeft: number;
  daysTotal: number;
  // "salary" = event/payday-driven; "time" = fixed calendar period; "calendar"
  // = the monthly fallback used when an event space has no salary yet.
  source: "salary" | "time" | "calendar";
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

// ---------------------------------------------------------------------------
// Time-driven (fixed-length, calendar) cycles
// ---------------------------------------------------------------------------
// A space in "time" mode has a fixed period length (weekly/monthly/quarterly/
// yearly) anchored to a reference date. The anchor lets a firm run a
// non-calendar fiscal year: anchoring on 1 Apr makes quarters fall
// Apr–Jun / Jul–Sep / Oct–Dec / Jan–Mar and the year run Apr–Mar. When no
// anchor is stored we use 2024-01-01 — a Monday — so weekly cycles land on
// Mondays and month/quarter/year periods align to the plain calendar.

const DEFAULT_ANCHOR = new Date(2024, 0, 1); // Mon, 1 Jan 2024 (local)

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// Build a local date at year/monthIndex on `day`, clamping to the month length
// (e.g. an anchor day of 31 lands on 30 April / 28 Feb).
function dateOnDay(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, Math.min(day, daysInMonth(year, monthIndex)));
}

// Parse an anchor into a local Date. A bare "YYYY-MM-DD" (how a SQL `date`
// serializes) is read as local midnight — `new Date("2024-04-01")` would parse
// as UTC and shift a day in negative-offset zones.
function parseAnchor(iso: string | null | undefined): Date {
  if (!iso) return DEFAULT_ANCHOR;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(iso);
}

function bounds(start: Date, end: Date, now: Date): CycleBounds {
  return {
    start,
    end,
    daysTotal: Math.max(1, diffDays(end, start)),
    daysLeft: Math.max(1, diffDays(end, now)),
    source: "time",
    lastSalaryAt: null,
    predicted: false, // fixed calendar boundaries are deterministic
  };
}

/**
 * Current fixed-length period for a time-driven space.
 * @param length weekly | monthly | quarterly | yearly
 * @param anchorIso optional ISO date the periods are counted from (fiscal start)
 */
export function computeTimeCycle(
  length: Cycle,
  anchorIso: string | null | undefined,
  now = new Date(),
): CycleBounds {
  const anchor = parseAnchor(anchorIso);

  if (length === "weekly") {
    // Midnight of the anchor day; step forward in whole weeks to the block
    // containing `now`.
    const base = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    const k = Math.floor(diffDays(now, base) / 7);
    const start = new Date(base.getTime() + k * 7 * 86400000);
    const end = new Date(start.getTime() + 7 * 86400000);
    return bounds(start, end, now);
  }

  const periodMonths = length === "monthly" ? 1 : length === "quarterly" ? 3 : 12;
  const anchorDay = anchor.getDate();
  const anchorAbs = anchor.getFullYear() * 12 + anchor.getMonth();
  const nowAbs = now.getFullYear() * 12 + now.getMonth();

  // Align `now`'s month back to the nearest period boundary at/behind it.
  let startAbs = anchorAbs + Math.floor((nowAbs - anchorAbs) / periodMonths) * periodMonths;
  const monthOf = (abs: number) => ((abs % 12) + 12) % 12;
  const yearOf = (abs: number) => Math.floor(abs / 12);
  let start = dateOnDay(yearOf(startAbs), monthOf(startAbs), anchorDay);
  // The anchor day can push the boundary past `now` within its month; if so the
  // active period actually began one period earlier.
  if (now.getTime() < start.getTime()) {
    startAbs -= periodMonths;
    start = dateOnDay(yearOf(startAbs), monthOf(startAbs), anchorDay);
  }
  const endAbs = startAbs + periodMonths;
  const end = dateOnDay(yearOf(endAbs), monthOf(endAbs), anchorDay);
  return bounds(start, end, now);
}

export type CycleMode = "event" | "time";

export type CycleConfig = {
  mode: CycleMode;
  length: Cycle; // used in "time" mode
  anchorDate?: string | null; // used in "time" mode (fiscal start)
};

/**
 * Resolve a stored household row into a CycleConfig, applying defaults: an
 * absent/invalid mode falls back to event (today's behaviour), the length falls
 * back to the space-kind default, and an absent anchor means plain calendar.
 */
export function cycleConfigForSpace(
  space:
    | { cycle_mode?: string | null; cycle?: string | null; cycle_anchor_date?: string | null; kind?: string | null }
    | null
    | undefined,
): CycleConfig {
  return {
    mode: space?.cycle_mode === "time" ? "time" : "event",
    length: cycleForSpace(space),
    anchorDate: space?.cycle_anchor_date ?? null,
  };
}

/**
 * Single entry point for "what cycle are we in". Event spaces derive the period
 * from their anchor income's receipts (payday-driven, variable length); time
 * spaces use a fixed calendar period. `receiptsDesc` are the anchor income's
 * occurred_at strings, newest first (ignored in time mode).
 */
export function cycleFor(
  config: CycleConfig,
  receiptsDesc: string[],
  now = new Date(),
): CycleBounds {
  if (config.mode === "time") return computeTimeCycle(config.length, config.anchorDate, now);
  return computeCycle(receiptsDesc, now);
}
