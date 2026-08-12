// Run with: bun test src/lib/health-score.test.ts
import { test, expect } from "bun:test";
import { computeHealth, projectFundedFraction, type ScoreInputs } from "./health-score";

test("projectFundedFraction: a future-dated long-term goal reads as on-plan, not ~0%", () => {
  const now = new Date("2026-01-01");
  const goal = [
    { id: "kid", target_type: "goal_by_date", target_value: 30000, target_deadline: "2040-01-01" },
  ];
  // Naive balance/target would be 500/30000 ≈ 0.017; on-plan future goal → 1.
  expect(projectFundedFraction(goal, { kid: 500 }, now)).toBe(1);
});

test("projectFundedFraction: an overdue, unmet goal is marked down", () => {
  const now = new Date("2026-01-01");
  const goal = [
    { id: "kid", target_type: "goal_by_date", target_value: 30000, target_deadline: "2020-01-01" },
  ];
  expect(projectFundedFraction(goal, { kid: 15000 }, now)).toBe(0.5);
});

test("projectFundedFraction: recurring target compares balance to target", () => {
  const rows = [{ id: "a", target_type: "fixed_monthly", target_value: 120 }];
  expect(projectFundedFraction(rows, { a: 120 })).toBe(1);
  expect(projectFundedFraction(rows, { a: 60 })).toBe(0.5);
  expect(projectFundedFraction([], {})).toBeNull();
});

const base: ScoreInputs = {
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

function scoreOf(r: ReturnType<typeof computeHealth>, key: string): number | undefined {
  return r.scores.find((s) => s.key === key)?.value;
}

test("a strong household scores near the top and earns the right badges", () => {
  const r = computeHealth({
    ...base,
    bucketsTotal: 9000, // 9 months of the €1,000 outgoings → emergency 100
    investedAmount: 9000, // surplus fully invested → deploy 100
    fundedFraction: 1, // projects fully funded → funding 100
    incomeSources: [1500, 1500], // two balanced sources
    incomePercentile: 90,
    netWorth: 100000,
    hasNetWorthData: true,
    hasInvestment: true,
  });
  expect(scoreOf(r, "emergency")).toBe(100);
  expect(scoreOf(r, "debt")).toBe(100);
  expect(scoreOf(r, "funding")).toBe(100);
  expect(scoreOf(r, "deploy")).toBe(100);
  expect(scoreOf(r, "consumption")).toBe(100);
  expect(r.overall).toBeGreaterThan(85);
  for (const badge of ["emergency_ready", "debt_slayer", "consistent_saver", "investing"]) {
    expect(r.badges).toContain(badge);
  }
});

test("consuming above income zeroes the consumption pillar", () => {
  const r = computeHealth({ ...base, fixedTotal: 3600 }); // outgoings 120% of income
  expect(scoreOf(r, "consumption")).toBe(0);
});

test("living well within income scores the consumption pillar high", () => {
  // base: outgoings 1000 of 3000 income (~33%).
  expect(scoreOf(computeHealth(base), "consumption")).toBe(100);
});

test("high debt-to-income zeroes the debt pillar", () => {
  const r = computeHealth({ ...base, debtMonthly: 1200 }); // 40% of income
  expect(scoreOf(r, "debt")).toBe(0);
  expect(r.debtRatio).toBe(0.4);
});

test("more balanced income sources and a higher percentile lift the income pillar", () => {
  const one = scoreOf(computeHealth(base), "income")!;
  const two = scoreOf(computeHealth({ ...base, incomeSources: [1500, 1500] }), "income")!;
  const rich = scoreOf(computeHealth({ ...base, incomePercentile: 90 }), "income")!;
  expect(two).toBeGreaterThan(one);
  expect(rich).toBeGreaterThan(one);
});

test("a large idle buffer scores deploy low; investing it scores high", () => {
  const idle = computeHealth({ ...base, bucketsTotal: 9000, investedAmount: 0 });
  const invested = computeHealth({ ...base, bucketsTotal: 9000, investedAmount: 9000 });
  expect(scoreOf(idle, "deploy")!).toBeLessThan(scoreOf(invested, "deploy")!);
});

test("funding consistency reflects progress toward project targets", () => {
  const r = computeHealth({ ...base, bucketsTotal: 500, fundedFraction: 0.5 });
  expect(scoreOf(r, "funding")).toBe(50);
  expect(r.badges).toContain("consistent_saver");
});

test("net worth is scored as a multiple of annual income when data exists", () => {
  const r = computeHealth({
    ...base,
    income: 2000,
    netWorth: 72000, // 3x annual income → 85
    hasNetWorthData: true,
  });
  expect(scoreOf(r, "networth")).toBe(85);
  expect(r.badges).toContain("net_worth_positive");
});

test("a household with only debt and nothing else gets a getting-started badge", () => {
  const r = computeHealth({ ...base, debtMonthly: 1200 });
  expect(r.badges).toEqual(["getting_started"]);
});
