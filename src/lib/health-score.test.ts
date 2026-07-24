// Run with: bun test src/lib/health-score.test.ts
import { test, expect } from "bun:test";
import { computeHealth, type ScoreInputs } from "./health-score";

const base: ScoreInputs = {
  income: 3000,
  savedThisCycle: 0,
  fixedTotal: 1000,
  debtMonthly: 0,
  bucketsTotal: 0,
  liquidAssets: 0,
  netWorth: 0,
  hasNetWorthData: false,
  hasInvestment: false,
  variablePool: 0,
  variableSpent: 0,
  cycleProgress: 0,
};

test("a strong household scores near the top and earns the right badges", () => {
  const r = computeHealth({
    ...base,
    savedThisCycle: 600, // 20% savings rate -> savings pillar 100
    debtMonthly: 0, // debt pillar 100
    bucketsTotal: 9000, // 9 months of the €1,000 outgoings -> emergency 100
  });
  expect(scoreOf(r, "savings")).toBe(100);
  expect(scoreOf(r, "debt")).toBe(100);
  expect(scoreOf(r, "emergency")).toBe(100);
  expect(r.overall).toBe(100);
  expect(r.badges).toEqual(
    expect.arrayContaining(["emergency_ready", "debt_slayer", "consistent_saver"]),
  );
});

test("high debt-to-income zeroes the debt pillar", () => {
  const r = computeHealth({ ...base, debtMonthly: 1200 }); // 40% of income
  expect(scoreOf(r, "debt")).toBe(0);
  expect(r.debtRatio).toBe(0.4);
});

test("nothing recorded yields a getting-started badge and a low overall", () => {
  const r = computeHealth(base);
  expect(r.badges).toEqual(["getting_started"]);
  expect(r.overall).toBeLessThan(50);
});

test("net worth is scored as a multiple of annual income when data exists", () => {
  const r = computeHealth({
    ...base,
    income: 2000,
    netWorth: 72000, // 3x annual income -> 85
    hasNetWorthData: true,
  });
  expect(scoreOf(r, "networth")).toBe(85);
  expect(r.badges).toContain("net_worth_positive");
});

function scoreOf(r: ReturnType<typeof computeHealth>, key: string): number | undefined {
  return r.scores.find((s) => s.key === key)?.value;
}
