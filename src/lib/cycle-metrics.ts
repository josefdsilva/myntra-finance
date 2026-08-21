// Compounding-value foundation: turn a closed cycle into one durable row of
// metrics, and read a series of those rows into trends the UI and coach can use.
//
// This module is PURE (no I/O). The server fn gathers the raw numbers for a
// cycle and calls `computeCycleMetrics`; screens and the coach read arrays of
// rows through the series helpers. Keeping it side-effect-free means it is fully
// unit-testable and can run on the client (backfill) or the server (rollover).

import { computeHealth, type ScoreInputs, type SubScore, type Badge } from "./health-score";

function round2(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** Fields common to both household and company cycle snapshots. */
type CommonCycleInputs = {
  /** Canonical cycle key, ISO date (YYYY-MM-DD). */
  cycleStart: string;
  cycleEnd: string;
  /** Actuals for the cycle, in the space's currency. */
  incomeActual: number;
  spendActual: number;
  fixedTotal: number;
  debtTotal: number;
  projectFunded: number;
  everydayPool: number;
  everydaySpent: number;
  availableEnd: number;
  /** Leak-free ratios (null when not judgeable this cycle). */
  superfluousShare: number | null;
  consumptionRatio: number | null;
  /** Estimates in force at close, for calibration. */
  incomeExpected: number | null;
  plannedSpend: number | null;
  baselineAtClose: number | null;
  /** When false, the score is stored as null (too little set up to judge). */
  scoreable?: boolean;
  /** Anything extra to keep in the metrics JSONB (business KPIs, plan calibration…). */
  extra?: Record<string, unknown>;
};

export type CycleMetricsInputs =
  | ({ kind: "personal"; score: ScoreInputs } & CommonCycleInputs)
  | ({ kind: "business"; score: BusinessScoreInputs } & CommonCycleInputs);

/** The row payload written to `cycle_metrics` (snake_case to match the table). */
export type CycleMetricsRow = {
  kind: "personal" | "business";
  cycle_start: string;
  cycle_end: string;
  income_actual: number;
  spend_actual: number;
  fixed_total: number;
  debt_total: number;
  project_funded: number;
  surplus_actual: number;
  everyday_pool: number;
  everyday_spent: number;
  available_end: number;
  score_overall: number | null;
  superfluous_share: number | null;
  consumption_ratio: number | null;
  income_expected: number | null;
  planned_spend: number | null;
  baseline_at_close: number | null;
  metrics: {
    subScores: SubScore[];
    badges: Badge[];
    monthsOfEmergency: number;
    savingsRate: number;
    debtRatio: number;
    [k: string]: unknown;
  };
};

/** Compute a single cycle's snapshot row from already-gathered primitives. */
export function computeCycleMetrics(input: CycleMetricsInputs): CycleMetricsRow {
  const health = computeHealth(input.score as ScoreInputs);

  // Surplus actual = what was truly left after fixed+debt, everyday spend, and
  // what was set aside to projects this cycle (fixedTotal already bundles debt).
  const surplus = round2(
    input.incomeActual - input.fixedTotal - input.spendActual - input.projectFunded,
  );

  return {
    kind: input.kind,
    cycle_start: input.cycleStart,
    cycle_end: input.cycleEnd,
    income_actual: round2(input.incomeActual),
    spend_actual: round2(input.spendActual),
    fixed_total: round2(input.fixedTotal),
    debt_total: round2(input.debtTotal),
    project_funded: round2(input.projectFunded),
    surplus_actual: surplus,
    everyday_pool: round2(input.everydayPool),
    everyday_spent: round2(input.everydaySpent),
    available_end: round2(input.availableEnd),
    score_overall: input.scoreable === false ? null : health.overall,
    superfluous_share: input.superfluousShare,
    consumption_ratio: input.consumptionRatio,
    income_expected: input.incomeExpected,
    planned_spend: input.plannedSpend,
    baseline_at_close: input.baselineAtClose,
    metrics: {
      subScores: health.scores,
      badges: health.badges,
      monthsOfEmergency: health.monthsOfEmergency,
      savingsRate: health.savingsRate,
      debtRatio: health.debtRatio,
      ...(input.extra ?? {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Series helpers — read an ordered (oldest → newest) array of cycles.
// ---------------------------------------------------------------------------

/** Linear-regression slope over the values (by index) + a coarse direction. */
export function trend(values: Array<number | null | undefined>): {
  slope: number;
  direction: "up" | "down" | "flat";
} {
  const pts = values
    .map((v, i) => [i, v] as const)
    .filter((p): p is readonly [number, number] => typeof p[1] === "number" && Number.isFinite(p[1]));
  const n = pts.length;
  if (n < 2) return { slope: 0, direction: "flat" };
  const meanX = pts.reduce((s, p) => s + p[0], 0) / n;
  const meanY = pts.reduce((s, p) => s + p[1], 0) / n;
  let num = 0;
  let den = 0;
  for (const [x, y] of pts) {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const eps = 1e-9;
  return { slope, direction: slope > eps ? "up" : slope < -eps ? "down" : "flat" };
}

/** Change from the previous point to the last, for a numeric key. */
export function deltaVsPrev<T>(series: T[], key: keyof T): number | null {
  if (series.length < 2) return null;
  const cur = Number(series[series.length - 1]?.[key]);
  const prev = Number(series[series.length - 2]?.[key]);
  if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  return round2(cur - prev);
}

/** Trailing average of the last `n` values (default 3), ignoring nulls. */
export function movingAverage(values: Array<number | null | undefined>, n = 3): number | null {
  const nums = values
    .slice(-n)
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));
  if (!nums.length) return null;
  return round2(nums.reduce((s, v) => s + v, 0) / nums.length);
}

/**
 * The latest value versus the trailing average of the preceding cycles.
 * `n` preceding cycles (default 3). Returns null when there isn't enough history.
 */
export function vsAverage<T>(
  series: T[],
  key: keyof T,
  n = 3,
): { value: number; average: number; deltaPct: number } | null {
  if (series.length < 2) return null;
  const value = Number(series[series.length - 1]?.[key]);
  if (!Number.isFinite(value)) return null;
  const priorVals = series.slice(0, -1).map((r) => Number(r[key]));
  const average = movingAverage(priorVals, n);
  if (average == null || average === 0) return null;
  return { value: round2(value), average, deltaPct: round2(((value - average) / Math.abs(average)) * 100) };
}

/**
 * Consecutive cycles (counting back from the newest) for which `predicate` holds.
 * `predicate(cur, prev)` — prev is the cycle immediately before `cur`, or undefined.
 */
export function streak<T>(series: T[], predicate: (cur: T, prev: T | undefined) => boolean): number {
  let count = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    if (predicate(series[i], series[i - 1])) count += 1;
    else break;
  }
  return count;
}

/**
 * Mean signed error of an estimate vs the actual, as a percentage, across the
 * cycles that carry both. Positive means the actual ran ABOVE the estimate
 * (e.g. spending beat the plan / the estimate was too low). Null when no cycle
 * has a usable estimate. This is the number the coach quotes for calibration.
 */
export function meanSignedErrorPct<T>(
  series: T[],
  estimateKey: keyof T,
  actualKey: keyof T,
): { pct: number; n: number } | null {
  const errs: number[] = [];
  for (const row of series) {
    const est = Number(row[estimateKey]);
    const act = Number(row[actualKey]);
    if (!Number.isFinite(est) || est === 0 || !Number.isFinite(act)) continue;
    errs.push((act - est) / Math.abs(est));
  }
  if (!errs.length) return null;
  const mean = errs.reduce((s, v) => s + v, 0) / errs.length;
  return { pct: round2(mean * 100), n: errs.length };
}
