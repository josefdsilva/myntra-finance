// Run with: bun test src/lib/cycle-metrics.test.ts
import { test, expect } from "bun:test";
import {
  computeCycleMetrics,
  trend,
  deltaVsPrev,
  movingAverage,
  vsAverage,
  streak,
  meanSignedErrorPct,
  type CycleMetricsInputs,
} from "./cycle-metrics";
import type { ScoreInputs } from "./health-score";

const personalScore: ScoreInputs = {
  income: 3000,
  incomeSources: [3000],
  incomePercentile: null,
  fixedTotal: 1000,
  debtMonthly: 0,
  bucketsTotal: 0,
  liquidAssets: 0,
  investedAmount: 0,
  netWorth: 0,
  hasNetWorthData: false,
  hasInvestment: false,
  fundedFraction: null,
  superfluousShare: null,
  variablePool: 0,
  variableSpent: 0,
  cycleProgress: 1,
};

const commonPersonal: CycleMetricsInputs = {
  kind: "personal",
  score: personalScore,
  cycleStart: "2026-07-25",
  cycleEnd: "2026-08-24",
  incomeActual: 3000,
  spendActual: 1400,
  fixedTotal: 1000,
  debtTotal: 0,
  projectFunded: 300,
  everydayPool: 2000,
  everydaySpent: 1400,
  availableEnd: 300,
  superfluousShare: 0.2,
  consumptionRatio: 0.8,
  incomeExpected: 3000,
  plannedSpend: 2000,
  baselineAtClose: 2000,
};

test("computeCycleMetrics (personal) captures surplus, score and metrics payload", () => {
  const row = computeCycleMetrics(commonPersonal);
  expect(row.kind).toBe("personal");
  // 3000 income − 1000 fixed − 1400 spent − 300 to projects = 300 free
  expect(row.surplus_actual).toBe(300);
  expect(typeof row.score_overall).toBe("number");
  expect(row.superfluous_share).toBe(0.2);
  expect(row.metrics.subScores.length).toBeGreaterThan(0);
  expect(row.metrics.badges.length).toBeGreaterThan(0);
  expect(typeof row.metrics.debtRatio).toBe("number");
});

test("scoreable:false stores a null score but still records the money", () => {
  const row = computeCycleMetrics({ ...commonPersonal, scoreable: false });
  expect(row.score_overall).toBeNull();
  expect(row.surplus_actual).toBe(300);
});

test("trend detects direction", () => {
  expect(trend([1, 2, 3, 4]).direction).toBe("up");
  expect(trend([4, 3, 2, 1]).direction).toBe("down");
  expect(trend([2, 2, 2]).direction).toBe("flat");
  expect(trend([5]).direction).toBe("flat");
});

test("deltaVsPrev and movingAverage", () => {
  expect(deltaVsPrev([{ v: 60 }, { v: 66 }], "v")).toBe(6);
  expect(deltaVsPrev([{ v: 1 }], "v")).toBeNull();
  expect(movingAverage([1, 2, 3, 4], 3)).toBe(3); // (2+3+4)/3
});

test("vsAverage compares the latest against the trailing average", () => {
  const rows = [{ x: 100 }, { x: 100 }, { x: 100 }, { x: 130 }];
  const r = vsAverage(rows, "x", 3);
  expect(r?.average).toBe(100);
  expect(r?.deltaPct).toBe(30);
});

test("streak counts consecutive cycles from the newest", () => {
  expect(streak([{ s: -1 }, { s: 1 }, { s: 2 }, { s: 3 }], (c) => c.s > 0)).toBe(3);
  expect(streak([{ s: 1 }, { s: 1 }, { s: -1 }], (c) => c.s > 0)).toBe(0);
  // "improving" using the previous point
  expect(streak([{ v: 1 }, { v: 2 }, { v: 3 }], (c, p) => p === undefined || c.v > p.v)).toBe(3);
});

test("meanSignedErrorPct reports calibration drift with sign", () => {
  const rows = [
    { est: 100, act: 110 },
    { est: 200, act: 220 },
  ];
  const c = meanSignedErrorPct(rows, "est", "act");
  expect(c?.pct).toBe(10); // actual ran 10% above estimate
  expect(c?.n).toBe(2);
  expect(meanSignedErrorPct([{ est: 0, act: 5 }], "est", "act")).toBeNull();
});
