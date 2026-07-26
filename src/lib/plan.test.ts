// Run with: bun test src/lib/plan.test.ts
import { test, expect } from "bun:test";
import {
  planAppliesToMonth,
  unfundedPlannedSpend,
  leftoverObligation,
  buildForecast,
  plansInWindow,
  type Plan,
} from "./plan";

const p = (o: Partial<Plan>): Plan => ({
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

test("plansInWindow: payday cycle 25 Jul–25 Aug picks up August plans, not July", () => {
  const start = new Date(2026, 6, 25); // 25 Jul 2026
  const end = new Date(2026, 7, 25); // 25 Aug 2026
  const julyPlan = p({ id: "jul", month: "2026-07-01" });
  const augPlan = p({ id: "aug", month: "2026-08-01" });
  const sepPlan = p({ id: "sep", month: "2026-09-01" });
  const got = plansInWindow([julyPlan, augPlan, sepPlan], start, end).map((x) => x.id);
  expect(got).toEqual(["aug"]);
});

test("plansInWindow: each occurrence lands in exactly one tiling window", () => {
  const aug = p({ id: "aug", month: "2026-08-01" });
  const prev = plansInWindow([aug], new Date(2026, 5, 25), new Date(2026, 6, 25)); // 25 Jun–25 Jul
  const curr = plansInWindow([aug], new Date(2026, 6, 25), new Date(2026, 7, 25)); // 25 Jul–25 Aug
  const next = plansInWindow([aug], new Date(2026, 7, 25), new Date(2026, 8, 25)); // 25 Aug–25 Sep
  expect(prev.length).toBe(0);
  expect(curr.length).toBe(1);
  expect(next.length).toBe(0);
});

test("plansInWindow: excludes done unless includeDone; matches done by its month", () => {
  const doneAug = p({ id: "d", month: "2026-08-01", done: true });
  const start = new Date(2026, 6, 25);
  const end = new Date(2026, 7, 25);
  expect(plansInWindow([doneAug], start, end).length).toBe(0);
  expect(plansInWindow([doneAug], start, end, true).map((x) => x.id)).toEqual(["d"]);
});

test("plansInWindow: ongoing plan contributes one occurrence per window", () => {
  const ongoing = p({ id: "o", month: "2026-01-01", recurrence: "ongoing" });
  const got = plansInWindow([ongoing], new Date(2026, 6, 25), new Date(2026, 7, 25));
  expect(got.length).toBe(1); // the Aug 1 occurrence
});

test("one_off applies only to its month", () => {
  const plan = p({ month: "2026-08-01", recurrence: "one_off" });
  expect(planAppliesToMonth(plan, "2026-08")).toBe(true);
  expect(planAppliesToMonth(plan, "2026-09")).toBe(false);
  expect(planAppliesToMonth(plan, "2027-08")).toBe(false);
});

test("annual repeats the same calendar month from its start year", () => {
  const plan = p({ month: "2026-10-01", recurrence: "annual" });
  expect(planAppliesToMonth(plan, "2026-10")).toBe(true);
  expect(planAppliesToMonth(plan, "2027-10")).toBe(true);
  expect(planAppliesToMonth(plan, "2026-09")).toBe(false);
  expect(planAppliesToMonth(plan, "2025-10")).toBe(false); // before it started
});

test("ongoing applies from its month onward", () => {
  const plan = p({ month: "2026-09-01", recurrence: "ongoing", direction: "income" });
  expect(planAppliesToMonth(plan, "2026-08")).toBe(false);
  expect(planAppliesToMonth(plan, "2026-09")).toBe(true);
  expect(planAppliesToMonth(plan, "2027-03")).toBe(true);
});

test("unfundedPlannedSpend excludes funded plans and income", () => {
  const plans = [
    p({ id: "a", amount: 400, month: "2026-08-01" }), // unfunded spend
    p({ id: "b", amount: 250, month: "2026-08-01", bucket_id: "bk1" }), // funded, excluded
    p({ id: "c", amount: 800, month: "2026-08-01", direction: "income" }), // income, excluded
  ];
  expect(unfundedPlannedSpend(plans, "2026-08")).toBe(400);
  expect(unfundedPlannedSpend(plans, "2026-09")).toBe(0);
});

test("leftoverObligation counts open estimate + resolved actual, excludes project-paid", () => {
  const plans = [
    p({ id: "open", amount: 705, month: "2026-09-01" }), // open → estimate
    p({ id: "done", amount: 705, actual_amount: 620, done: true, month: "2026-09-01" }), // resolved → actual
    p({ id: "proj", amount: 400, month: "2026-09-01", bucket_id: "bk1" }), // paid from a project → excluded
    p({ id: "inc", amount: 800, month: "2026-09-01", direction: "income" }), // income → excluded
  ];
  expect(leftoverObligation(plans, "2026-09")).toBe(1325); // 705 + 620
  // A resolved plan only counts in its own month.
  expect(leftoverObligation(plans, "2026-10")).toBe(0);
});

test("buildForecast overlays income and unfunded spend per month", () => {
  const plans: Plan[] = [
    p({ id: "tyres", amount: 400, month: "2026-08-01", recurrence: "one_off" }),
    p({ id: "service", amount: 250, month: "2026-10-01", recurrence: "one_off" }),
    p({ id: "raise", amount: 800, month: "2026-09-01", recurrence: "ongoing", direction: "income" }),
    p({ id: "xmas", amount: 300, month: "2026-12-01", recurrence: "annual" }),
  ];
  const fc = buildForecast({
    plans,
    baseline: 2000,
    monthlyIncome: 2500,
    startMonth: new Date(2026, 7, 1), // Aug 2026
    months: 5, // Aug..Dec
  });
  const by = Object.fromEntries(fc.map((m) => [m.ym, m]));

  // August: tyres 400 unfunded, no raise yet.
  expect(by["2026-08"].income).toBe(2500);
  expect(by["2026-08"].plannedSpendUnfunded).toBe(400);
  expect(by["2026-08"].leftover).toBe(100); // 2500 - 2000 - 400

  // September: raise kicks in, no spend.
  expect(by["2026-09"].income).toBe(3300);
  expect(by["2026-09"].leftover).toBe(1300); // 3300 - 2000

  // October: service 250, raise still on.
  expect(by["2026-10"].income).toBe(3300);
  expect(by["2026-10"].leftover).toBe(1050); // 3300 - 2000 - 250

  // December: xmas 300.
  expect(by["2026-12"].leftover).toBe(1000); // 3300 - 2000 - 300
});

test("buildForecast flags a shortfall month", () => {
  const plans: Plan[] = [p({ id: "big", amount: 2000, month: "2026-08-01" })];
  const fc = buildForecast({
    plans,
    baseline: 1500,
    monthlyIncome: 2500,
    startMonth: new Date(2026, 7, 1),
    months: 1,
  });
  expect(fc[0].leftover).toBe(-1000); // 2500 - 1500 - 2000
  expect(fc[0].shortfall).toBe(true);
});

test("funded plan does not reduce leftover", () => {
  const plans: Plan[] = [
    p({ id: "funded", amount: 600, month: "2026-08-01", bucket_id: "bk" }),
  ];
  const fc = buildForecast({
    plans,
    baseline: 2000,
    monthlyIncome: 2500,
    startMonth: new Date(2026, 7, 1),
    months: 1,
  });
  expect(fc[0].plannedSpend).toBe(600); // shown
  expect(fc[0].plannedSpendUnfunded).toBe(0); // but not subtracted
  expect(fc[0].leftover).toBe(500); // 2500 - 2000
});
