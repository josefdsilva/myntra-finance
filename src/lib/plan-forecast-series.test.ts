// Run with: bun test src/lib/plan-forecast-series.test.ts
import { test, expect } from "bun:test";
import { buildForecastSeries, type ProjectInput } from "./plan-forecast-series";
import type { Plan } from "./plan";
import type { Debt } from "./debt-schedule";

const plan = (o: Partial<Plan>): Plan => ({
  id: o.id ?? "x",
  label: o.label ?? "p",
  amount: o.amount ?? 100,
  direction: o.direction ?? "spend",
  month: o.month ?? "2026-08-01",
  recurrence: o.recurrence ?? "one_off",
  category: null,
  bucket_id: o.bucket_id ?? null,
  done: false,
  actual_amount: null,
});

const proj = (o: Partial<ProjectInput>): ProjectInput => ({
  id: o.id ?? "proj",
  name: o.name ?? "Project",
  kind: o.kind ?? "savings",
  target_type: o.target_type ?? "fixed_monthly",
  target_value: o.target_value ?? 100,
  target_deadline: o.target_deadline ?? null,
  balance: o.balance ?? 0,
});

test("series folds income plans, accumulates project balance and uninvested surplus", () => {
  const series = buildForecastSeries({
    plans: [plan({ id: "raise", amount: 500, month: "2026-09-01", recurrence: "ongoing", direction: "income" })],
    projects: [proj({ id: "p1", target_type: "fixed_monthly", target_value: 100, balance: 200 })],
    debts: [],
    baseline: 2000,
    monthlyIncome: 2500,
    months: 3,
    startMonth: new Date(2026, 7, 1), // Aug 2026
  });

  // August: no raise yet.
  expect(series[0].income).toBe(2500);
  expect(series[0].surplus).toBe(500);
  expect(series[0].projects.p1).toBe(300); // 200 + 100
  expect(series[0].uninvestedSurplus).toBe(400); // 500 - 100

  // September: +500 income kicks in.
  expect(series[1].income).toBe(3000);
  expect(series[1].surplus).toBe(1000);
  expect(series[1].projects.p1).toBe(400);
  expect(series[1].uninvestedSurplus).toBe(1300); // 400 + (1000 - 100)

  // October: still +500.
  expect(series[2].projects.p1).toBe(500);
  expect(series[2].uninvestedSurplus).toBe(2300);
  expect(series[2].debts).toEqual({});
  expect(series[2].interestSaved).toBe(0);
});

test("goal_by_date project stops at its target", () => {
  const series = buildForecastSeries({
    plans: [],
    projects: [
      proj({
        id: "g",
        target_type: "goal_by_date",
        target_value: 300,
        target_deadline: "2026-09-01",
        balance: 200,
      }),
    ],
    debts: [],
    baseline: 2000,
    monthlyIncome: 3000,
    months: 3,
    startMonth: new Date(2026, 7, 1), // Aug 2026, one month to the deadline
  });
  // Remaining 100 spread over 1 month → reaches 300, then holds.
  expect(series[0].projects.g).toBe(300);
  expect(series[1].projects.g).toBe(300);
  expect(series[2].projects.g).toBe(300);
});

test("a debt's remaining balance falls month over month", () => {
  const debt = {
    id: "d1",
    principal_remaining: 10000,
    starting_principal: 10000,
    monthly_amount: 300,
    deduced_rate_pct: 5,
    tan_pct: null,
    taeg_pct: 5,
    maturity_date: "2030-08-01",
    opened_at: "2026-08-01",
    last_recompute_at: "2026-08-01",
    created_at: "2026-08-01T00:00:00Z",
  } as unknown as Debt;

  const series = buildForecastSeries({
    plans: [],
    projects: [],
    debts: [debt],
    baseline: 2000,
    monthlyIncome: 3000,
    months: 3,
    startMonth: new Date(2026, 7, 1),
  });
  expect(series[0].debts.d1).toBeGreaterThan(series[1].debts.d1);
  expect(series[1].debts.d1).toBeGreaterThan(series[2].debts.d1);
  expect(series[2].interestSaved).toBeGreaterThanOrEqual(0);
});
