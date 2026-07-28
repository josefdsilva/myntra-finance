// Run with: bun test src/lib/projection.test.ts
import { test, expect } from "bun:test";
import {
  projectForward,
  positionAt,
  projectScenarios,
  projectProjects,
  runwayMonths,
  monthsBetween,
  MAX_PROJECTION_MONTHS,
  type ProjectionInput,
} from "./projection";
import type { Plan } from "./plan";

const plan = (o: Partial<Plan>): Plan => ({
  id: o.id ?? "x",
  label: o.label ?? "item",
  amount: o.amount ?? 100,
  direction: o.direction ?? "spend",
  month: o.month ?? "2026-08-01",
  recurrence: o.recurrence ?? "one_off",
  category: o.category ?? null,
  bucket_id: o.bucket_id ?? null,
  done: o.done ?? false,
  actual_amount: o.actual_amount ?? null,
});

const base = (over: Partial<ProjectionInput> = {}): ProjectionInput => ({
  startMonth: new Date(2026, 0, 1), // Jan 2026
  months: 4,
  monthlyIncome: 1000,
  fixedNonDebtMonthly: 200,
  variableMonthly: 100,
  debts: [],
  plans: [],
  startingSavings: 0,
  assetsTotal: 0,
  ...over,
});

test("debt pays off and then frees up surplus", () => {
  const s = projectForward(
    base({ debts: [{ id: "loan", label: "loan", balance: 1000, monthlyRate: 0, installment: 500 }] }),
  );
  // Month 1 & 2 pay 500 each; month 3 the loan is gone.
  expect(s[0].debtPaid).toBe(500);
  expect(s[0].surplus).toBe(200); // 1000 - 300 - 500
  expect(s[1].debtRemaining).toBe(0);
  expect(s[2].debtPaid).toBe(0);
  expect(s[2].debtFree).toBe(true);
  expect(s[2].surplus).toBe(700); // 1000 - 300 - 0
});

test("plans land on their own month", () => {
  const s = projectForward(
    base({
      months: 4,
      plans: [
        plan({ id: "mar", amount: 500, direction: "spend", month: "2026-03-01" }),
        plan({ id: "apr", amount: 800, direction: "income", month: "2026-04-01" }),
      ],
    }),
  );
  // start Jan; series[0]=Feb, [1]=Mar, [2]=Apr, [3]=May
  expect(s[1].ym).toBe("2026-03");
  expect(s[1].expenses).toBe(800); // 300 everyday + 500 plan
  expect(s[2].ym).toBe("2026-04");
  expect(s[2].income).toBe(1800); // 1000 + 800 plan
});

test("net worth = assets + savings − debt", () => {
  const s = projectForward(
    base({ assetsTotal: 5000, startingSavings: 1000, months: 3 }),
  );
  const last = s[s.length - 1];
  expect(last.netWorth).toBeCloseTo(last.assets + last.savings - last.debtRemaining, 2);
});

test("positionAt returns the month at/just before the target", () => {
  const input = base({ months: 12 });
  const pos = positionAt(input, new Date(2026, 5, 15)); // mid-June 2026
  expect(pos?.ym).toBe("2026-06");
});

test("runwayMonths flags when savings goes negative", () => {
  // Spend more than income, no debt: savings drops by 200/mo from 300 start.
  const s = projectForward(
    base({ monthlyIncome: 500, fixedNonDebtMonthly: 500, variableMonthly: 200, startingSavings: 300, months: 6 }),
  );
  // surplus = 500 - 700 = -200/mo; savings: 100, -100, ... first negative at month 2.
  expect(runwayMonths(s)).toBe(2);
});

test("scenarios bracket the expected line", () => {
  const b = base({ assetsTotal: 10000, monthlyIncome: 2000, fixedNonDebtMonthly: 1000, variableMonthly: 500, months: 24 });
  const { expected, cautious, optimistic } = projectScenarios(b);
  const end = (arr: typeof expected) => arr[arr.length - 1].netWorth;
  expect(end(optimistic)).toBeGreaterThanOrEqual(end(expected));
  expect(end(expected)).toBeGreaterThanOrEqual(end(cautious));
});

test("projectProjects: ongoing grows, goal caps at target", () => {
  const res = projectProjects(
    [
      { id: "ong", name: "Emergency", balance: 1000, monthlyContribution: 100 },
      { id: "g1", name: "Trip", balance: 500, monthlyContribution: 100, goalTarget: 1000, monthsToGoal: 3 },
      { id: "g2", name: "Car", balance: 500, monthlyContribution: 200, goalTarget: 1000, monthsToGoal: 6 },
    ],
    12,
  );
  const by = Object.fromEntries(res.map((r) => [r.id, r]));
  expect(by.ong.projectedBalance).toBe(2200); // 1000 + 100*12
  expect(by.g1.projectedBalance).toBe(800); // 500 + 100*3, deadline caps months
  expect(by.g1.reachedGoal).toBe(false);
  expect(by.g2.projectedBalance).toBe(1000); // 500 + 200*6 = 1700, capped at target
  expect(by.g2.reachedGoal).toBe(true);
});

test("horizon is clamped to the max", () => {
  const s = projectForward(base({ months: 100 }));
  expect(s.length).toBe(MAX_PROJECTION_MONTHS);
});

test("monthsBetween counts whole months", () => {
  expect(monthsBetween(new Date(2026, 0, 1), new Date(2030, 10, 1))).toBe(58);
  expect(monthsBetween(new Date(2030, 0, 1), new Date(2026, 0, 1))).toBe(0);
});

test("one-off expense reduces net worth that month; income raises it", () => {
  const withE = projectForward(
    base({
      months: 4,
      events: [
        { id: "e1", kind: "one_off", direction: "expense", month: "2026-03", amount: 500 },
      ],
    }),
  );
  const without = projectForward(base({ months: 4 }));
  // March = series[1]; net worth 500 lower from then on.
  expect(without[1].netWorth - withE[1].netWorth).toBeCloseTo(500, 2);
  expect(without[3].netWorth - withE[3].netWorth).toBeCloseTo(500, 2);
});

test("a new loan is net-worth-neutral at signing, then its payments bite", () => {
  const s = projectForward(
    base({
      months: 6,
      events: [
        { id: "L", kind: "loan", month: "2026-03", principal: 6000, aprPct: 0, termMonths: 6, label: "car loan" },
      ],
    }),
  );
  const without = projectForward(base({ months: 6 }));
  // At signing month (March = index 1): +6000 cash, +6000 debt → net worth ~unchanged.
  expect(s[1].netWorth).toBeCloseTo(without[1].netWorth, 0);
  // Debt appears and is being serviced.
  expect(s[1].debtRemaining).toBeGreaterThan(0);
  expect(s[2].debtPaid).toBeGreaterThan(without[2].debtPaid);
});

test("overpay is net-worth-neutral and frees future surplus", () => {
  const s = projectForward(
    base({
      months: 4,
      debts: [{ id: "d", label: "credit", balance: 1000, monthlyRate: 0, installment: 200 }],
      startingSavings: 1000,
      events: [{ id: "o", kind: "overpay", month: "2026-02", amount: 800, targetDebtId: "d" }],
    }),
  );
  // Feb = index 0: 800 cash out, 800 debt down → net worth unchanged vs pre-event.
  // Debt clears fast, so by later months debtPaid is 0 and surplus is higher.
  expect(s[s.length - 1].debtRemaining).toBe(0);
  expect(s[s.length - 1].debtPaid).toBe(0);
});

test("asset purchase swaps cash for an asset (net-worth-neutral at purchase)", () => {
  const s = projectForward(
    base({
      months: 3,
      startingSavings: 30000,
      events: [
        { id: "car", kind: "asset_purchase", month: "2026-02", price: 25000, assetValue: 25000 },
      ],
    }),
  );
  const without = projectForward(base({ months: 3, startingSavings: 30000 }));
  expect(s[0].netWorth).toBeCloseTo(without[0].netWorth, 0); // neutral at purchase
  expect(s[0].savings).toBeCloseTo(without[0].savings - 25000, 0);
  expect(s[0].assets).toBeCloseTo(without[0].assets + 25000, 0);
});

test("recurring income persists from its month", () => {
  const s = projectForward(
    base({
      months: 4,
      events: [
        { id: "raise", kind: "recurring", direction: "income", fromMonth: "2026-03", amount: 300 },
      ],
    }),
  );
  const without = projectForward(base({ months: 4 }));
  expect(s[0].income).toBe(without[0].income); // Feb, before the raise
  expect(s[1].income).toBe(without[1].income + 300); // Mar onward
  expect(s[2].income).toBe(without[2].income + 300);
});
